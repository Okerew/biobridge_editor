const { exec } = require('child_process');
const os = require('os');

function executePythonCode() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const editorId = activeTab.getAttribute("data-editor-id");

    const activeEditor = ace.edit(editorId);
    if (!activeEditor) return;

    const pythonCode = activeEditor.getValue();

    // Get the system's downloads folder path
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    // Create a temporary file in downloads folder
    const tempFilePath = path.join(downloadsPath, 'tempCodeRunner.py');
    fs.writeFileSync(tempFilePath, pythonCode);

    exec(`python3 ${tempFilePath}`, (error, stdout, stderr) => {
        fs.unlinkSync(tempFilePath);

        if (error) {
            console.error('Error executing Python code:', error.message);
            return;
        }
        if (stderr) {
            console.error('Python script encountered an error:', stderr);
            return;
        }
        console.log(stdout);
    });
}

function executePythonCodeblock(codeBlock) {
    // Get the system's downloads folder path
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    // Create a temporary file in downloads folder
    const tempFilePath = path.join(downloadsPath, 'tempCodeRunner.py');
    fs.writeFileSync(tempFilePath, codeBlock);

    return new Promise((resolve, reject) => {
        exec(`python3 ${tempFilePath}`, (error, stdout, stderr) => {
            fs.unlinkSync(tempFilePath);

            if (error) {
                reject(error);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function runMarkdownPythonNotebook() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const editorId = activeTab.getAttribute("data-editor-id");
    const activeEditor = ace.edit(editorId);
    if (!activeEditor) return;

    const editorValue = activeEditor.getValue();
    const combinedCode = parseMarkdownForPython(editorValue);
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    // Create a temporary file in downloads folder
    const tempFilePath = path.join(downloadsPath, 'tempCodeRunner.py');
    fs.writeFileSync(tempFilePath, combinedCode);

    exec(`python3 ${tempFilePath}`, (error, stdout, stderr) => {
        fs.unlinkSync(tempFilePath);

        if (error) {
            console.error('Error executing Python code:', error.message);
            return;
        }
        if (stderr) {
            console.error('Python script encountered an error:', stderr);
            return;
        }
        console.log(stdout);
    });
}
function htmlOutput() {
    var x = document.getElementById("output-container");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}

// Separate <script> tags from the HTML
function separateScriptTags(htmlCode) {
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;

    let htmlContent = htmlCode;
    let scriptContent = "";

    htmlCode = htmlCode.replace(scriptRegex, (match, script) => {
        scriptContent += script;
        return "";
    });

    return { htmlContent, scriptContent };
}

// Run the Markdown conversion
function runMarkdown() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const editorId = activeTab.getAttribute("data-editor-id");
    const activeEditor = ace.edit(editorId);
    const editorValue = activeEditor.getValue();

    // Sanitize Markdown content before conversion
    const sanitizedMarkdown = DOMPurify.sanitize(editorValue);

    const convertedHtml = convertToHtml(sanitizedMarkdown);

    const resultDiv = document.createElement("div");
    resultDiv.innerHTML = convertedHtml;

    const outputContainer = document.getElementById("output-container");
    outputContainer.innerHTML = "";
    outputContainer.appendChild(resultDiv);

    applySyntaxHighlighting();
}

// Convert Markdown to HTML
function convertToHtml(markdown) {
    const noScripts = markdown.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        ""
    );
    const noJavaScriptLinks = noScripts.replace(
        /\bhttps?:\/\/\S+\bjavascript:/gi,
        ""
    );
    const noDataURIImages = noJavaScriptLinks.replace(
        /\bdata:image\/\S+;base64,\S+/gi,
        ""
    );

    // Convert markdown to HTML
    return noDataURIImages
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold
        .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic
        .replace(/^###(.*?)(\n|$)/gm, "<h3>$1</h3>") // H3
        .replace(/^##(.*?)(\n|$)/gm, "<h2>$1</h2>") // H2
        .replace(/^#(.*?)(\n|$)/gm, "<h1>$1</h1>") // H1
        .replace(/\n[-*] (.*?)\n/g, "<ul><li>$1</li></ul>") // Bullet list with `-` and `*`
        .replace(/```(\s*[\w-]*?)\n([\s\S]*?)```/g, (match, lang, code) => { // Code block
            lang = lang.trim() || 'text';
            return `<div class="code-block" data-lang="${lang}">${code}</div>`;
        })
        .replace(/`([^`]+)`/g, "<code>$1</code>") // Inline code
        .replace(/\$([^\$]+)\$/g, '<span class="math-inline">$$$1$$</span>'); // Inline math
}

// Apply syntax highlighting for code blocks using Ace.js
function applySyntaxHighlighting() {
    const actual_editor = ace.edit("editor");
    const currentTheme = actual_editor.getTheme();

    const codeBlocks = document.querySelectorAll('.code-block');

    codeBlocks.forEach(block => {
        const lang = block.getAttribute('data-lang') || 'text';

        const editorDiv = document.createElement('div');
        editorDiv.style.width = "100%";
        editorDiv.style.height = "100px";
        block.replaceWith(editorDiv);

        const editor = ace.edit(editorDiv);
        editor.setTheme(currentTheme);
        editor.session.setMode(`ace/mode/${lang}`);
        editor.setValue(block.textContent.trim(), -1);
        editor.setReadOnly(true);
    });
}

function deleteTempDir(tempDirPath) {
    fs.rmdirSync(tempDirPath, { recursive: true });
}

function executeCppCode() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const editorId = activeTab.getAttribute("data-editor-id");
    const activeEditor = ace.edit(editorId);
    if (!activeEditor) return;

    const cppCode = activeEditor.getValue();

    // Get the system's downloads folder path
    const downloadsPath = path.join(os.homedir(), 'Downloads');

    // Create a temporary directory in downloads folder
    const tempDirPath = path.join(downloadsPath, 'tempCodeRunnerCpp');
    fs.mkdirSync(tempDirPath);

    // Create a source file in the directory
    const tempFilePath = path.join(tempDirPath, 'main.cpp');
    fs.writeFileSync(tempFilePath, cppCode);

    // Generate CMakeLists.txt
    const cmakeContent = generateCMakeListsForCpp(tempDirPath, cppCode);
    const cmakeFilePath = path.join(tempDirPath, 'CMakeLists.txt');
    fs.writeFileSync(cmakeFilePath, cmakeContent);

    // Compile and execute using CMake
    exec(`cd ${tempDirPath} && cmake . && make && ./main`, (error, stdout, stderr) => {
        deleteTempDir(tempDirPath);

        if (error) {
            console.error('Error executing C++ code:', error.message);
        }
        if (stderr) {
            console.error('C++ program encountered an error:', stderr);
            return;
        }
        console.log(stdout);
    });
}

function generateCMakeListsForCpp(tempDirPath, cppCode) {
    let cmakeContent = `cmake_minimum_required(VERSION 3.10)\n`;
    cmakeContent += `project(tempCodeRunnerCpp)\n\n`;

    cmakeContent += `add_executable(main main.cpp)\n`;

    // List of standard libraries to skip
    const stdCLibraries = [
        "cstddef",
        "cstdlib",
        "version",
        "limits",
        "climits",
        "cfloat",
        "cstdint",
        "stdfloat",
        "new",
        "typeinfo",
        "source_location",
        "exception",
        "initializer_list",
        "compare",
        "coroutine",
        "csignal",
        "csetjmp",
        "cstdarg",
        "concepts",
        "stdexcept",
        "stacktrace",
        "cassert",
        "cerrno",
        "system_error",
        "memory",
        "memory_resource",
        "scoped_allocator",
        "type_traits",
        "ratio",
        "utility",
        "tuple",
        "optional",
        "variant",
        "any",
        "debugging",
        "expected",
        "bitset",
        "functional",
        "typeindex",
        "execution",
        "charconv",
        "format",
        "bit",
        "string_view",
        "string",
        "cctype",
        "cwctype",
        "cstring",
        "cwchar",
        "cuchar",
        "array",
        "deque",
        "forward_list",
        "list",
        "vector",
        "map",
        "set",
        "unordered_map",
        "unordered_set",
        "queue",
        "stack",
        "flat_map",
        "flat_set",
        "span",
        "mdspan",
        "iterator",
        "ranges",
        "generator",
        "algorithm",
        "numeric",
        "cfenv",
        "complex",
        "random",
        "valarray",
        "cmath",
        "linalg",
        "numbers",
        "chrono",
        "ctime",
        "locale",
        "clocale",
        "codecvt",
        "text_encoding",
        "iosfwd",
        "iostream",
        "ios",
        "streambuf",
        "istream",
        "ostream",
        "iomanip",
        "print",
        "sstream",
        "spanstream",
        "fstream",
        "syncstream",
        "filesystem",
        "cstdio",
        "cinttypes",
        "strstream",
        "regex",
        "stop_token",
        "thread",
        "atomic",
        "rcu",
        "stdatomic.h",
        "mutex",
        "shared_mutex",
        "condition_variable",
        "semaphore",
        "latch",
        "barrier",
        "future",
        "hazard_pointer",
        "cstdbool",
        "ccomplex",
        "ctgmath",
        "cstdalign",
        "ciso646"
    ];

    // Extract included libraries
    const includedLibraries = parseIncludedLibraries(cppCode);
    includedLibraries.forEach(lib => {
        if (!stdCLibraries.includes(lib)) { // Check if it's not a library to skip
            cmakeContent += `find_package(${lib})\n`;
            cmakeContent += `target_link_libraries(main ${lib}::${lib})\n`;
        }
    });

    return cmakeContent;
}


function parseIncludedLibraries(cppCode) {
    const libraries = new Set();
    const lines = cppCode.split('\n');

    lines.forEach(line => {
        // Check if the line contains an include directive
        const match = line.match(/^\s*#include\s+<(.+)>/);
        if (match) {
            const library = match[1].split('/')[0]; // Extract the library name
            libraries.add(library);
        }
    });

    return Array.from(libraries);
}

function executeCCode() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const editorId = activeTab.getAttribute("data-editor-id");
    const activeEditor = ace.edit(editorId);
    if (!activeEditor) return;

    const cCode = activeEditor.getValue();

    // Get the system's downloads folder path
    const downloadsPath = path.join(os.homedir(), 'Downloads');

    // Create a temporary directory in downloads folder
    const tempDirPath = path.join(downloadsPath, 'tempCodeRunnerC');
    fs.mkdirSync(tempDirPath);

    // Create a source file in the directory
    const tempFilePath = path.join(tempDirPath, 'main.c');
    fs.writeFileSync(tempFilePath, cCode);

    // Generate CMakeLists.txt
    const cmakeContent = generateCMakeListsForC(tempDirPath, cCode);
    const cmakeFilePath = path.join(tempDirPath, 'CMakeLists.txt');
    fs.writeFileSync(cmakeFilePath, cmakeContent);

    // Compile and execute using CMake
    exec(`cd ${tempDirPath} && cmake . && make && ./main`, (error, stdout, stderr) => {
        deleteTempDir(tempDirPath);

        if (error) {
            console.error('Error executing C code:', error.message);
        }
        if (stderr) {
            console.error('C program encountered an error:', stderr);
            return;
        }
        console.log(stdout);
    });
}

function generateCMakeListsForC(tempDirPath, cCode) {
    let cmakeContent = `cmake_minimum_required(VERSION 3.10)\n`;
    cmakeContent += `project(tempCodeRunnerC)\n\n`;

    cmakeContent += `add_executable(main main.c)\n`;

    // List of C default libraries
    const cLibraries = [
        "assert.h",
        "complex.h",
        "ctype.h",
        "errno.h",
        "fenv.h",
        "float.h",
        "inttypes.h",
        "iso646.h",
        "limits.h",
        "locale.h",
        "math.h",
        "setjmp.h",
        "signal.h",
        "stdalign.h",
        "stdarg.h",
        "stdatomic.h",
        "stdbit.h",
        "stdbool.h",
        "stdckdint.h",
        "stddef.h",
        "stdint.h",
        "stdio.h",
        "stdlib.h",
        "stdnoreturn.h",
        "string.h",
        "tgmath.h",
        "threads.h",
        "time.h",
        "uchar.h",
        "wchar.h",
        "wctype.h"
    ];

    cLibraries.forEach(lib => {
        cmakeContent += `find_package(${lib})\n`;
        cmakeContent += `target_link_libraries(main ${lib}::${lib})\n`;
    });

    return cmakeContent;
}
