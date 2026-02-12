#!/usr/bin/env node
/**
 * Code Analyzer for vinyl-collection
 *
 * Analyzes app.js, index.html and style.css for:
 *  - Code metrics (LOC, functions, file sizes)
 *  - JavaScript quality issues (long functions, globals, innerHTML, loose equality, etc.)
 *  - HTML accessibility and structure
 *  - CSS complexity (selectors, !important, duplicates)
 *
 * Usage:  node analyze.js [--json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FILES = {
    js: path.join(ROOT, 'app.js'),
    html: path.join(ROOT, 'index.html'),
    css: path.join(ROOT, 'style.css'),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
}

function countLines(text) {
    if (!text) return 0;
    return text.split('\n').length;
}

function fileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    return (bytes / 1024).toFixed(1) + ' KB';
}

// ─── JavaScript Analysis ────────────────────────────────────────────────────

function analyzeJS(source) {
    if (!source) return null;
    const lines = source.split('\n');
    const issues = [];
    const metrics = {};

    // -- Function extraction --
    // Match: function name(, async function name(, const name = function(, const name = (
    // Also: .addEventListener('...', (   .addEventListener('...', function
    const funcRegex = /(?:(?:async\s+)?function\s+(\w+)\s*\(|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?(?:function\s*)?\(|(\w+)\s*:\s*(?:async\s+)?function\s*\()/g;
    const functions = [];

    // More robust approach: track braces to find function boundaries
    const funcStartRegex = /^(?:(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(funcStartRegex);
        if (match) {
            const name = match[1] || match[2];
            // Count the function length by tracking braces
            let braceCount = 0;
            let started = false;
            let endLine = i;
            for (let j = i; j < lines.length; j++) {
                for (const ch of lines[j]) {
                    if (ch === '{') { braceCount++; started = true; }
                    if (ch === '}') braceCount--;
                }
                if (started && braceCount <= 0) { endLine = j; break; }
            }
            const length = endLine - i + 1;
            functions.push({ name, startLine: i + 1, endLine: endLine + 1, length });
        }
    }

    metrics.functionCount = functions.length;
    metrics.functions = functions;

    // -- Long functions (> 30 lines) --
    const longFunctions = functions.filter(f => f.length > 30);
    longFunctions.forEach(f => {
        issues.push({
            type: 'warning',
            category: 'complexity',
            message: `Function "${f.name}" is ${f.length} lines long (line ${f.startLine})`,
            line: f.startLine,
        });
    });

    // -- Average function length --
    if (functions.length > 0) {
        metrics.avgFunctionLength = Math.round(
            functions.reduce((s, f) => s + f.length, 0) / functions.length
        );
        metrics.maxFunctionLength = Math.max(...functions.map(f => f.length));
        metrics.longestFunction = functions.reduce((a, b) => a.length > b.length ? a : b).name;
    }

    // -- Global variables --
    const globalVarRegex = /^(?:let|var)\s+(\w+)/;
    const globalConstRegex = /^const\s+(\w+)/;
    const globals = [];
    const constants = [];
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trimStart();
        // Only count top-level (no indentation or single level)
        if (lines[i].match(/^(?:let|var)\s+(\w+)/)) {
            const m = lines[i].match(/^(?:let|var)\s+(\w+)/);
            globals.push({ name: m[1], line: i + 1 });
        }
        if (lines[i].match(/^const\s+(\w+)/)) {
            const m = lines[i].match(/^const\s+(\w+)/);
            constants.push({ name: m[1], line: i + 1 });
        }
    }
    metrics.globalVariables = globals.length;
    metrics.globalConstants = constants.length;

    if (globals.length > 5) {
        issues.push({
            type: 'warning',
            category: 'globals',
            message: `${globals.length} mutable global variables detected (let/var). Consider encapsulating state.`,
            details: globals.map(g => `  - ${g.name} (line ${g.line})`).join('\n'),
        });
    }

    // -- Loose equality (== / !=) --
    const looseEqLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip lines inside strings (simple heuristic: ignore lines that are mostly string content)
        // Match == or != but not === or !==
        if (/[^!=]==[^=]/.test(line) || /[^!]!=[^=]/.test(line)) {
            looseEqLines.push(i + 1);
        }
    }
    if (looseEqLines.length > 0) {
        issues.push({
            type: 'info',
            category: 'quality',
            message: `${looseEqLines.length} loose equality checks (== / !=) found`,
            details: `Lines: ${looseEqLines.join(', ')}`,
        });
    }

    // -- innerHTML usage (potential XSS) --
    const innerHTMLLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('.innerHTML')) {
            innerHTMLLines.push(i + 1);
        }
    }
    if (innerHTMLLines.length > 0) {
        // Check if there's an escape function
        const hasEscFn = source.includes('function esc(');
        issues.push({
            type: hasEscFn ? 'info' : 'warning',
            category: 'security',
            message: `${innerHTMLLines.length} innerHTML assignments found${hasEscFn ? ' (esc() helper detected)' : ' — potential XSS risk'}`,
            details: `Lines: ${innerHTMLLines.join(', ')}`,
        });
    }

    // -- alert() usage --
    const alertLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (/\balert\s*\(/.test(lines[i])) {
            alertLines.push(i + 1);
        }
    }
    if (alertLines.length > 0) {
        issues.push({
            type: 'info',
            category: 'ux',
            message: `${alertLines.length} alert() calls — consider custom notification UI`,
            details: `Lines: ${alertLines.join(', ')}`,
        });
    }

    // -- console.log --
    const consoleLogs = [];
    for (let i = 0; i < lines.length; i++) {
        if (/\bconsole\.\w+\s*\(/.test(lines[i])) {
            consoleLogs.push(i + 1);
        }
    }
    if (consoleLogs.length > 0) {
        issues.push({
            type: 'info',
            category: 'cleanup',
            message: `${consoleLogs.length} console.* calls found`,
            details: `Lines: ${consoleLogs.join(', ')}`,
        });
    }

    // -- Nesting depth analysis --
    let maxNesting = 0;
    let maxNestingLine = 0;
    let currentNesting = 0;
    for (let i = 0; i < lines.length; i++) {
        for (const ch of lines[i]) {
            if (ch === '{') currentNesting++;
            if (ch === '}') currentNesting--;
        }
        if (currentNesting > maxNesting) {
            maxNesting = currentNesting;
            maxNestingLine = i + 1;
        }
    }
    metrics.maxNestingDepth = maxNesting;

    if (maxNesting > 5) {
        issues.push({
            type: 'warning',
            category: 'complexity',
            message: `Max nesting depth is ${maxNesting} (around line ${maxNestingLine}). Consider extracting helpers.`,
            line: maxNestingLine,
        });
    }

    // -- try/catch blocks --
    let tryCatchCount = 0;
    for (const line of lines) {
        if (/\btry\s*\{/.test(line) || line.trim() === 'try {') tryCatchCount++;
    }
    metrics.tryCatchBlocks = tryCatchCount;

    // -- Event listeners --
    const eventListeners = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/\.addEventListener\s*\(\s*['"](\w+)['"]/);
        if (m) {
            eventListeners.push({ event: m[1], line: i + 1 });
        }
    }
    metrics.eventListenerCount = eventListeners.length;

    // -- Cyclomatic complexity estimate (count decision points) --
    let cyclomaticTotal = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (/\bif\s*\(/.test(trimmed)) cyclomaticTotal++;
        if (/\belse\s+if\s*\(/.test(trimmed)) cyclomaticTotal++;
        if (/\bfor\s*\(/.test(trimmed)) cyclomaticTotal++;
        if (/\bwhile\s*\(/.test(trimmed)) cyclomaticTotal++;
        if (/\bswitch\s*\(/.test(trimmed)) cyclomaticTotal++;
        if (/\bcase\s+/.test(trimmed)) cyclomaticTotal++;
        if (/\?\s*/.test(trimmed) && trimmed.includes('?') && !trimmed.startsWith('//')) cyclomaticTotal++;
        if (/\|\|/.test(trimmed)) cyclomaticTotal++;
        if (/&&/.test(trimmed)) cyclomaticTotal++;
    }
    metrics.cyclomaticComplexity = cyclomaticTotal;

    // -- Duplicate code detection (simple: find similar long lines) --
    const significantLines = {};
    let duplicateCount = 0;
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.length > 40 && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
            if (significantLines[trimmed]) {
                significantLines[trimmed].push(i + 1);
                duplicateCount++;
            } else {
                significantLines[trimmed] = [i + 1];
            }
        }
    }
    const duplicateLines = Object.entries(significantLines)
        .filter(([, lns]) => lns.length > 1)
        .map(([code, lns]) => ({ code: code.substring(0, 80), lines: lns }));

    if (duplicateLines.length > 0) {
        metrics.duplicatePatterns = duplicateLines.length;
        issues.push({
            type: 'info',
            category: 'duplication',
            message: `${duplicateLines.length} duplicate code patterns detected`,
            details: duplicateLines.slice(0, 5).map(d =>
                `  Lines ${d.lines.join(', ')}: ${d.code}...`
            ).join('\n'),
        });
    }

    // -- Magic numbers --
    const magicNumbers = [];
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
        // Find standalone numbers that aren't 0, 1, -1, or in an object key context
        const matches = trimmed.matchAll(/(?<!['":\w])(\d{3,})(?!['":\w])/g);
        for (const m of matches) {
            const num = parseInt(m[1]);
            if (num > 100 && !trimmed.includes('const') && !trimmed.includes('max=') && !trimmed.includes('min=')) {
                magicNumbers.push({ value: num, line: i + 1 });
            }
        }
    }
    if (magicNumbers.length > 3) {
        issues.push({
            type: 'info',
            category: 'maintainability',
            message: `${magicNumbers.length} potential magic numbers found`,
            details: magicNumbers.slice(0, 5).map(m =>
                `  Line ${m.line}: ${m.value}`
            ).join('\n'),
        });
    }

    return { metrics, issues };
}

// ─── HTML Analysis ──────────────────────────────────────────────────────────

function analyzeHTML(source) {
    if (!source) return null;
    const lines = source.split('\n');
    const issues = [];
    const metrics = {};

    // -- Element counts --
    const tagMatches = source.match(/<(\w+)[\s>]/g) || [];
    const tagCounts = {};
    for (const match of tagMatches) {
        const tag = match.replace(/</, '').replace(/[\s>]/, '').toLowerCase();
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
    metrics.elementCounts = tagCounts;
    metrics.totalElements = tagMatches.length;

    // -- Missing lang attribute --
    if (!/<html[^>]*\slang\s*=/.test(source)) {
        issues.push({
            type: 'warning',
            category: 'accessibility',
            message: 'Missing lang attribute on <html> tag',
        });
    }

    // -- Images without alt --
    const imgRegex = /<img\b([^>]*)>/gi;
    let imgMatch;
    let imgsWithoutAlt = 0;
    let totalImgs = 0;
    while ((imgMatch = imgRegex.exec(source))) {
        totalImgs++;
        if (!/\balt\s*=/.test(imgMatch[1])) {
            imgsWithoutAlt++;
        }
    }
    if (imgsWithoutAlt > 0) {
        issues.push({
            type: 'warning',
            category: 'accessibility',
            message: `${imgsWithoutAlt} of ${totalImgs} <img> tags missing alt attribute`,
        });
    }

    // -- Form inputs without labels --
    const inputIds = [];
    const inputRegex = /<(?:input|select|textarea)\b[^>]*\bid\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let inputMatch;
    while ((inputMatch = inputRegex.exec(source))) {
        inputIds.push(inputMatch[1]);
    }
    const labelFors = [];
    const labelRegex = /<label\b[^>]*\bfor\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let labelMatch;
    while ((labelMatch = labelRegex.exec(source))) {
        labelFors.push(labelMatch[1]);
    }
    // Also count labels wrapping inputs
    const wrappedInputs = (source.match(/<label[^>]*>[\s\S]*?<(?:input|select|textarea)/gi) || []).length;
    const unlabeledInputs = inputIds.filter(id => !labelFors.includes(id));

    metrics.formInputs = inputIds.length;
    metrics.labeledInputs = labelFors.length + wrappedInputs;

    // -- Inline styles --
    const inlineStyles = (source.match(/\bstyle\s*=\s*"/g) || []).length;
    if (inlineStyles > 0) {
        issues.push({
            type: 'info',
            category: 'maintainability',
            message: `${inlineStyles} inline style(s) found — prefer CSS classes`,
        });
    }

    // -- Missing meta viewport --
    if (!/<meta\b[^>]*viewport/i.test(source)) {
        issues.push({
            type: 'warning',
            category: 'responsive',
            message: 'Missing viewport meta tag',
        });
    }

    // -- Script/link count --
    metrics.scripts = (source.match(/<script\b/gi) || []).length;
    metrics.stylesheets = (source.match(/<link\b[^>]*stylesheet/gi) || []).length;

    // -- Heading hierarchy --
    const headings = [];
    const headingRegex = /<(h[1-6])\b/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(source))) {
        headings.push(parseInt(hMatch[1][1]));
    }
    metrics.headings = headings;
    for (let i = 1; i < headings.length; i++) {
        if (headings[i] > headings[i - 1] + 1) {
            issues.push({
                type: 'info',
                category: 'accessibility',
                message: `Heading hierarchy skip: h${headings[i - 1]} → h${headings[i]}`,
            });
        }
    }

    return { metrics, issues };
}

// ─── CSS Analysis ───────────────────────────────────────────────────────────

function analyzeCSS(source) {
    if (!source) return null;
    const lines = source.split('\n');
    const issues = [];
    const metrics = {};

    // -- Selector count --
    const selectorRegex = /^([^@{}/\n][^{]*)\{/gm;
    const selectors = [];
    let selMatch;
    while ((selMatch = selectorRegex.exec(source))) {
        selectors.push(selMatch[1].trim());
    }
    metrics.selectorCount = selectors.length;

    // -- Duplicate selectors --
    const selectorCounts = {};
    for (const sel of selectors) {
        selectorCounts[sel] = (selectorCounts[sel] || 0) + 1;
    }
    const duplicateSelectors = Object.entries(selectorCounts)
        .filter(([, count]) => count > 1)
        .map(([sel, count]) => ({ selector: sel, count }));

    if (duplicateSelectors.length > 0) {
        issues.push({
            type: 'warning',
            category: 'maintainability',
            message: `${duplicateSelectors.length} duplicate CSS selector(s)`,
            details: duplicateSelectors.map(d =>
                `  "${d.selector}" appears ${d.count} times`
            ).join('\n'),
        });
    }

    // -- !important usage --
    const importantLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('!important')) {
            importantLines.push(i + 1);
        }
    }
    metrics.importantCount = importantLines.length;
    if (importantLines.length > 3) {
        issues.push({
            type: 'info',
            category: 'specificity',
            message: `${importantLines.length} !important declarations — may indicate specificity issues`,
            details: `Lines: ${importantLines.join(', ')}`,
        });
    }

    // -- CSS custom properties (variables) --
    const customProps = new Set();
    const propRegex = /--([\w-]+)\s*:/g;
    let propMatch;
    while ((propMatch = propRegex.exec(source))) {
        customProps.add(propMatch[1]);
    }
    metrics.customProperties = customProps.size;

    // -- var() references --
    const varRefs = new Set();
    const varRefRegex = /var\s*\(\s*--([\w-]+)\s*\)/g;
    let varRefMatch;
    while ((varRefMatch = varRefRegex.exec(source))) {
        varRefs.add(varRefMatch[1]);
    }

    // Check for unused custom properties
    const unusedProps = [...customProps].filter(p => !varRefs.has(p));
    if (unusedProps.length > 0) {
        issues.push({
            type: 'info',
            category: 'cleanup',
            message: `${unusedProps.length} potentially unused CSS custom properties`,
            details: unusedProps.map(p => `  --${p}`).join('\n'),
        });
    }

    // -- Media query count --
    const mediaQueries = (source.match(/@media\b/g) || []).length;
    metrics.mediaQueries = mediaQueries;

    // -- Color values (non-variable) --
    const rawColors = new Set();
    const colorRegex = /#[0-9a-fA-F]{3,8}\b/g;
    let colorMatch;
    // Only count colors outside :root / variable declarations
    const linesOutsideRoot = source.replace(/:root\s*\{[^}]*\}/gs, '');
    while ((colorMatch = colorRegex.exec(linesOutsideRoot))) {
        rawColors.add(colorMatch[0].toLowerCase());
    }
    const rgbaRegex = /rgba?\s*\([^)]+\)/g;
    let rgbaMatch;
    while ((rgbaMatch = rgbaRegex.exec(linesOutsideRoot))) {
        rawColors.add(rgbaMatch[0]);
    }

    if (rawColors.size > 5) {
        issues.push({
            type: 'info',
            category: 'consistency',
            message: `${rawColors.size} hard-coded color values outside :root — consider using CSS variables`,
            details: [...rawColors].slice(0, 8).map(c => `  ${c}`).join('\n'),
        });
    }
    metrics.hardcodedColors = rawColors.size;

    // -- Keyframes --
    metrics.keyframes = (source.match(/@keyframes\b/g) || []).length;

    return { metrics, issues };
}

// ─── Report Formatting ──────────────────────────────────────────────────────

function severityIcon(type) {
    switch (type) {
        case 'error': return '[ERROR]';
        case 'warning': return '[WARN] ';
        case 'info': return '[INFO] ';
        default: return '[????] ';
    }
}

function printReport(jsResult, htmlResult, cssResult, fileSizes) {
    const allIssues = [
        ...(jsResult?.issues || []).map(i => ({ ...i, file: 'app.js' })),
        ...(htmlResult?.issues || []).map(i => ({ ...i, file: 'index.html' })),
        ...(cssResult?.issues || []).map(i => ({ ...i, file: 'style.css' })),
    ];

    console.log('');
    console.log('='.repeat(70));
    console.log('  CODE ANALYSIS REPORT — vinyl-collection');
    console.log('  ' + new Date().toISOString().replace('T', ' ').substring(0, 19));
    console.log('='.repeat(70));

    // ── File Overview ──
    console.log('\n--- FILE OVERVIEW ---\n');
    const jsLines = countLines(readFile(FILES.js));
    const htmlLines = countLines(readFile(FILES.html));
    const cssLines = countLines(readFile(FILES.css));
    const totalLines = jsLines + htmlLines + cssLines;

    console.log(`  ${'File'.padEnd(20)} ${'Lines'.padStart(8)} ${'Size'.padStart(10)}`);
    console.log(`  ${'-'.repeat(20)} ${'-'.repeat(8)} ${'-'.repeat(10)}`);
    console.log(`  ${'app.js'.padEnd(20)} ${String(jsLines).padStart(8)} ${formatBytes(fileSizes.js).padStart(10)}`);
    console.log(`  ${'index.html'.padEnd(20)} ${String(htmlLines).padStart(8)} ${formatBytes(fileSizes.html).padStart(10)}`);
    console.log(`  ${'style.css'.padEnd(20)} ${String(cssLines).padStart(8)} ${formatBytes(fileSizes.css).padStart(10)}`);
    console.log(`  ${'─'.repeat(20)} ${'-'.repeat(8)} ${'-'.repeat(10)}`);
    console.log(`  ${'TOTAL'.padEnd(20)} ${String(totalLines).padStart(8)} ${formatBytes(fileSizes.js + fileSizes.html + fileSizes.css).padStart(10)}`);

    // ── JavaScript Metrics ──
    if (jsResult) {
        const m = jsResult.metrics;
        console.log('\n--- JAVASCRIPT METRICS ---\n');
        console.log(`  Functions:              ${m.functionCount}`);
        console.log(`  Avg function length:    ${m.avgFunctionLength || 0} lines`);
        console.log(`  Max function length:    ${m.maxFunctionLength || 0} lines (${m.longestFunction || 'N/A'})`);
        console.log(`  Global variables:       ${m.globalVariables} mutable, ${m.globalConstants} constants`);
        console.log(`  Event listeners:        ${m.eventListenerCount}`);
        console.log(`  try/catch blocks:       ${m.tryCatchBlocks}`);
        console.log(`  Max nesting depth:      ${m.maxNestingDepth}`);
        console.log(`  Cyclomatic complexity:   ${m.cyclomaticComplexity} (total decision points)`);
        if (m.duplicatePatterns) {
            console.log(`  Duplicate patterns:     ${m.duplicatePatterns}`);
        }

        if (m.functions && m.functions.length > 0) {
            console.log('\n  Functions by size:');
            const sorted = [...m.functions].sort((a, b) => b.length - a.length);
            sorted.slice(0, 10).forEach(f => {
                const bar = '#'.repeat(Math.min(f.length, 50));
                console.log(`    ${f.name.padEnd(25)} ${String(f.length).padStart(4)} lines  ${bar}`);
            });
        }
    }

    // ── HTML Metrics ──
    if (htmlResult) {
        const m = htmlResult.metrics;
        console.log('\n--- HTML METRICS ---\n');
        console.log(`  Total elements:         ${m.totalElements}`);
        console.log(`  Form inputs:            ${m.formInputs}`);
        console.log(`  Scripts:                ${m.scripts}`);
        console.log(`  Stylesheets:            ${m.stylesheets}`);
        if (m.headings && m.headings.length > 0) {
            console.log(`  Heading levels:         ${m.headings.map(h => 'h' + h).join(' → ')}`);
        }
    }

    // ── CSS Metrics ──
    if (cssResult) {
        const m = cssResult.metrics;
        console.log('\n--- CSS METRICS ---\n');
        console.log(`  Selectors:              ${m.selectorCount}`);
        console.log(`  Custom properties:      ${m.customProperties}`);
        console.log(`  !important:             ${m.importantCount}`);
        console.log(`  Media queries:          ${m.mediaQueries}`);
        console.log(`  Keyframe animations:    ${m.keyframes}`);
        console.log(`  Hard-coded colors:      ${m.hardcodedColors} (outside :root)`);
    }

    // ── Issues ──
    console.log('\n--- ISSUES ---\n');

    const warnings = allIssues.filter(i => i.type === 'warning');
    const infos = allIssues.filter(i => i.type === 'info');
    const errors = allIssues.filter(i => i.type === 'error');

    console.log(`  Found: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} info\n`);

    for (const issue of [...errors, ...warnings, ...infos]) {
        console.log(`  ${severityIcon(issue.type)} [${issue.file}] ${issue.message}`);
        if (issue.details) {
            issue.details.split('\n').forEach(line => console.log(`         ${line}`));
        }
    }

    // ── Summary Score ──
    console.log('\n--- SUMMARY ---\n');
    // Simple scoring: start at 100, subtract for issues
    let score = 100;
    score -= errors.length * 10;
    score -= warnings.length * 3;
    score -= infos.length * 1;
    score = Math.max(0, Math.min(100, score));

    const scoreBar = '█'.repeat(Math.round(score / 2)) + '░'.repeat(50 - Math.round(score / 2));
    let grade;
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    console.log(`  Score: ${score}/100 (${grade})`);
    console.log(`  ${scoreBar}`);

    console.log('\n' + '='.repeat(70));
    console.log('');

    return { score, grade, errors: errors.length, warnings: warnings.length, infos: infos.length, allIssues };
}

function printJSON(jsResult, htmlResult, cssResult, fileSizes) {
    const report = {
        timestamp: new Date().toISOString(),
        files: {
            'app.js': { lines: countLines(readFile(FILES.js)), size: fileSizes.js },
            'index.html': { lines: countLines(readFile(FILES.html)), size: fileSizes.html },
            'style.css': { lines: countLines(readFile(FILES.css)), size: fileSizes.css },
        },
        javascript: jsResult ? { metrics: jsResult.metrics, issues: jsResult.issues } : null,
        html: htmlResult ? { metrics: htmlResult.metrics, issues: htmlResult.issues } : null,
        css: cssResult ? { metrics: cssResult.metrics, issues: cssResult.issues } : null,
    };
    // Remove function details from JSON to keep it clean
    if (report.javascript?.metrics?.functions) {
        report.javascript.metrics.functions = report.javascript.metrics.functions.map(f => ({
            name: f.name, lines: f.length, start: f.startLine,
        }));
    }
    console.log(JSON.stringify(report, null, 2));
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
    const jsonMode = process.argv.includes('--json');

    const jsSource = readFile(FILES.js);
    const htmlSource = readFile(FILES.html);
    const cssSource = readFile(FILES.css);

    if (!jsSource && !htmlSource && !cssSource) {
        console.error('No source files found. Run from the project root directory.');
        process.exit(1);
    }

    const fileSizes = {
        js: fileSize(FILES.js),
        html: fileSize(FILES.html),
        css: fileSize(FILES.css),
    };

    const jsResult = analyzeJS(jsSource);
    const htmlResult = analyzeHTML(htmlSource);
    const cssResult = analyzeCSS(cssSource);

    if (jsonMode) {
        printJSON(jsResult, htmlResult, cssResult, fileSizes);
    } else {
        const summary = printReport(jsResult, htmlResult, cssResult, fileSizes);
        process.exit(summary.errors > 0 ? 1 : 0);
    }
}

main();
