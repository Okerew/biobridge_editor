function parsePython(editorValue) {
    const code = editorValue;
    const outline = [];
    const lines = code.split("\n");
    let indentationLevel = 0;
    const indentStack = [0];
    let imports = new Map();
    let declaredVars = new Set();
    let usedVars = new Map();
    let functionParams = new Set();
    let definedFunctions = new Set();
    let inFunction = false;
    let lastIndentationLevel = 0;
    let currentScope = "global";
    let scopes = [new Set()];

    function addError(type, message, line, column) {
        outline.push({ type, message, loc: { start: { line, column } } });
    }

    function addToScope(name) {
        scopes[scopes.length - 1].add(name);
    }

    function isInScope(name) {
        for (let i = scopes.length - 1; i >= 0; i--) {
            if (scopes[i].has(name)) return true;
        }
        return false;
    }

    lines.forEach((line, index) => {
        const stripped = line.trim();
        const indentation = line.match(/^\s*/)[0].length;

        // Handle indentation and scopes
        if (indentation < indentStack[indentStack.length - 1]) {
            while (indentation < indentStack[indentStack.length - 1]) {
                indentStack.pop();
                indentationLevel--;
                scopes.pop();
            }
        } else if (indentation > indentStack[indentStack.length - 1]) {
            indentStack.push(indentation);
            indentationLevel++;
            scopes.push(new Set());
        }

        // Check indentation
        if (indentation % 4 !== 0) {
            addError(
                "IndentationWarning",
                "Indentation should be a multiple of 4 spaces",
                index + 1,
                1
            );
        }

        // Check for sudden large changes in indentation
        if (Math.abs(indentationLevel - lastIndentationLevel) > 1) {
            addError(
                "IndentationWarning",
                "Unusual indentation change",
                index + 1,
                1
            );
        }
        lastIndentationLevel = indentationLevel;

        // Function definitions
        if (stripped.startsWith("def ")) {
            const match = stripped.match(/def\s+(\w+)\s*\((.*?)\)/);
            if (match) {
                inFunction = true;
                currentScope = match[1];
                definedFunctions.add(match[1]);
                addToScope(match[1]);
                outline.push({
                    type: "Function",
                    name: match[1],
                    loc: { start: { line: index + 1, column: line.indexOf("def") + 1 } },
                    indentation: indentationLevel,
                });
                // Extract and add function parameters to functionParams and current scope
                const params = match[2]
                    .split(",")
                    .map((p) => p.trim().split("=")[0].trim());
                params.forEach((p) => {
                    functionParams.add(p);
                    addToScope(p);
                });
            }
        } else if (stripped.startsWith("class ")) {
            const match = stripped.match(/class\s+(\w+)/);
            if (match) {
                currentScope = match[1];
                addToScope(match[1]);
                outline.push({
                    type: "Class",
                    name: match[1],
                    loc: {
                        start: { line: index + 1, column: line.indexOf("class") + 1 },
                    },
                    indentation: indentationLevel,
                });
            }
        }

        // Check naming conventions
        if (stripped.match(/^\s*def\s+[A-Z]/)) {
            addError(
                "NamingConvention",
                "Function names should start with lowercase",
                index + 1,
                line.indexOf("def") + 1
            );
        }
        if (stripped.match(/^\s*class\s+[a-z]/)) {
            addError(
                "NamingConvention",
                "Class names should start with uppercase",
                index + 1,
                line.indexOf("class") + 1
            );
        }

        // Check for potentially dangerous practices
        if (stripped.includes("eval(") || stripped.includes("exec(")) {
            addError(
                "SecurityWarning",
                "Use of eval() or exec() can be dangerous",
                index + 1,
                line.indexOf("eval(") !== -1
                    ? line.indexOf("eval(") + 1
                    : line.indexOf("exec(") + 1
            );
        }

        // Check for common style issues
        if (stripped.match(/^\s*if\s*[^(]/)) {
            addError(
                "StyleWarning",
                "Missing parentheses in if statement",
                index + 1,
                line.indexOf("if") + 1
            );
        }
        if (stripped.includes("  #")) {
            addError(
                "StyleWarning",
                "There should be no spaces before inline comments",
                index + 1,
                line.indexOf("#") + 1
            );
        }

        // Check for potential type errors
        if (
            stripped.match(/[+\-*\/]=/) &&
            !stripped.includes("=") &&
            !stripped.startsWith("#")
        ) {
            addError(
                "PotentialTypeError",
                "Potential type error in arithmetic operation",
                index + 1,
                line.indexOf("=") + 1
            );
        }

        // Check for imports
        const importMatch = stripped.match(
            /^(?:from\s+(\w+)\s+)?import\s+([\w,\s]+)(?:\s+as\s+(\w+))?/
        );
        if (importMatch) {
            const fromModule = importMatch[1];
            const importedItems = importMatch[2]
                .split(",")
                .map((item) => item.trim());
            const asName = importMatch[3];

            if (fromModule && asName) {
                imports.set(asName, `${fromModule}.${importedItems[0]}`);
                addToScope(asName);
            } else if (fromModule) {
                importedItems.forEach((item) => {
                    imports.set(item, `${fromModule}.${item}`);
                    addToScope(item);
                });
            } else if (asName) {
                imports.set(asName, importedItems[0]);
                addToScope(asName);
            } else {
                importedItems.forEach((item) => {
                    imports.set(item, item);
                    addToScope(item);
                });
            }
        }

        // Variable assignments
        const varAssign = stripped.match(/^(\w+)\s*=/);
        if (varAssign) {
            declaredVars.add(varAssign[1]);
            addToScope(varAssign[1]);
        }

        // Check variable and function usage
        const usageMatches = stripped.matchAll(/\b(\w+)\b/g);
        for (const match of usageMatches) {
            const [, name] = match;
            if (
                !isInScope(name) &&
                !imports.has(name) &&
                !definedFunctions.has(name) &&
                !["True", "False", "None"].includes(name)
            ) {
                usedVars.set(name, (usedVars.get(name) || []).concat(index + 1));
            }
        }

        // Check for long lines
        if (line.length > 79) {
            addError("StyleWarning", "Line exceeds 79 characters", index + 1, 80);
        }

        // Check for TODO comments
        if (stripped.toLowerCase().includes("todo")) {
            addError(
                "TODO",
                "TODO found",
                index + 1,
                line.toLowerCase().indexOf("todo") + 1
            );
        }
    });

    // Check for undefined variables
    usedVars.forEach((lines, name) => {
        if (
            !declaredVars.has(name) &&
            !imports.has(name) &&
            !definedFunctions.has(name) &&
            !["True", "False", "None"].includes(name)
        ) {
        }
    });

    return outline;
}

function parseMarkdownForPython(editorValue) {
    const lines = editorValue.split("\n");
    let inCodeBlock = false;
    let combinedCode = "";

    lines.forEach((line) => {
        const trimmedLine = line.trim();

        // Detect the start of a Python code block
        if (trimmedLine.startsWith("```python")) {
            inCodeBlock = true;
            return; // Skip the opening code block line
        } else if (trimmedLine.startsWith("``` python")) {
            inCodeBlock = true;
            return; // Skip the opening code block line
        }
        else if (trimmedLine.startsWith('```biobridge')) {
            inCodeBlock = true;
            currentCodeBlock = '';  // Reset current code block
            return; // Skip the opening code block line
        }
        else if (trimmedLine.startsWith('``` biobridge')) {
            inCodeBlock = true;
            currentCodeBlock = '';  // Reset current code block
            return; // Skip the opening code block line
        }

        // Detect the end of a code block
        if (trimmedLine.startsWith("```") && inCodeBlock) {
            inCodeBlock = false;
            combinedCode += "\n"; // Add a newline to separate different code blocks
            return; // Skip the closing code block line
        }

        // If inside a Python code block, accumulate the code
        if (inCodeBlock) {
            combinedCode += line + "\n";
        }
    });

    return combinedCode.trim(); // Trim any excess whitespace or newlines
}

function parseMarkdownForPythonWithButtons() {
    const activeTab = document.querySelector(".tab.active");
    if (!activeTab) return;

    const editorId = activeTab.getAttribute("data-editor-id");
    const activeEditor = ace.edit(editorId);
    if (!activeEditor) return;

    const editorValue = activeEditor.getValue();
    const targetDivId = "notebook-block";
    const lines = editorValue.split('\n');
    let inCodeBlock = false;
    let currentCodeBlock = '';

    // Find the target div where the content should be inserted
    const targetDiv = document.getElementById(targetDivId);
    if (!targetDiv) {
        console.error('Target div not found');
        return;
    }

    lines.forEach((line) => {
        const trimmedLine = line.trim();

        // Detect the start of a Python code block
        if (trimmedLine.startsWith('```python')) {
            inCodeBlock = true;
            currentCodeBlock = '';  // Reset current code block
            return; // Skip the opening code block line
        }
        else if (trimmedLine.startsWith('``` python')) {
            inCodeBlock = true;
            currentCodeBlock = '';  // Reset current code block
            return; // Skip the opening code block line
        }
        else if (trimmedLine.startsWith('```biobridge')) {
            inCodeBlock = true;
            currentCodeBlock = '';  // Reset current code block
            return; // Skip the opening code block line
        }
        else if (trimmedLine.startsWith('``` biobridge')) {
            inCodeBlock = true;
            currentCodeBlock = '';  // Reset current code block
            return; // Skip the opening code block line
        }

        // Detect the end of a code block
        if (trimmedLine.startsWith('```') && inCodeBlock) {
            inCodeBlock = false;

            // Create a scope for the current code block
            (function(codeBlock) {
                // Create HTML elements for code block and button
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = codeBlock; // Set code block content

                // Create button for executing the code block
                const button = document.createElement('button');
                button.textContent = 'Run Code Block';

                // Create an element to hold the output of the code execution
                const outputDiv = document.createElement('div');
                outputDiv.className = 'output-div'; // Add a class for styling purposes

                // Attach the event handler for running the code block and displaying output
                button.onclick = async () => {
                    const result = await executePythonCodeblock(codeBlock);
                    if (result) {
                        // Clear previous output and display the new result
                        outputDiv.innerHTML = '';
                        const outputPre = document.createElement('pre');
                        outputPre.textContent = result;
                        outputDiv.appendChild(outputPre);
                    }
                };

                // Append code block, button, and output container to the target div
                pre.appendChild(code);
                targetDiv.appendChild(pre);
                targetDiv.appendChild(button);
                targetDiv.appendChild(outputDiv);
            })(currentCodeBlock); // Immediately invoke the function with the current code block

            return; // Skip the closing code block line
        }

        // If inside a Python code block, accumulate the code
        if (inCodeBlock) {
            currentCodeBlock += line + '\n';
        }
    });
}

// Helper function to escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function parseCPP(editorValue) {
    const code = editorValue;
    const outline = [];
    const lines = code.split("\n");
    let declaredVars = new Set();
    let usedVars = new Set();

    function addError(type, message, line, column) {
        outline.push({ type, message, loc: { start: { line, column } } });
    }

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("class ")) {
            const match = trimmedLine.match(/class\s+(\w+)/);
            if (match) {
                outline.push({
                    type: "Class",
                    name: match[1],
                    loc: {
                        start: { line: index + 1, column: line.indexOf("class") + 1 },
                    },
                });
            }
        } else if (trimmedLine.startsWith("struct ")) {
            const match = trimmedLine.match(/struct\s+(\w+)/);
            if (match) {
                outline.push({
                    type: "Struct",
                    name: match[1],
                    loc: {
                        start: { line: index + 1, column: line.indexOf("struct") + 1 },
                    },
                });
            }
        } else if (
            trimmedLine.match(
                /\w+\s+\w+\s*\([^)]*\)\s*(?:const)?\s*(?:noexcept)?\s*(?:=\s*0)?\s*(?:override)?\s*(?:final)?\s*(?:{\s*)?$/
            )
        ) {
            const match = trimmedLine.match(/(\w+)\s*\(/);
            if (match) {
                outline.push({
                    type: "Function",
                    name: match[1],
                    loc: {
                        start: { line: index + 1, column: line.indexOf(match[1]) + 1 },
                    },
                });
            }
        }

        // Check for common C++ errors
        if (trimmedLine.includes("using namespace std;")) {
            addError(
                outline,
                "StyleWarning",
                'Avoid using "using namespace std;" in global scope. It can lead to name conflicts.',
                index + 1,
                line.indexOf("using") + 1
            );
        }
        if (trimmedLine.match(/delete\s+\[]/)) {
            addError(
                outline,
                "MemoryError",
                'Use delete[] for array deallocation. "delete" without brackets is for single objects.',
                index + 1,
                line.indexOf("delete") + 1
            );
        }
        if (trimmedLine.match(/^\s*#include\s+[<"].*\.cpp[">]/)) {
            addError(
                outline,
                "IncludeError",
                "Avoid including .cpp files. Include header (.h) files instead.",
                index + 1,
                line.indexOf("#include") + 1
            );
        }
        if (trimmedLine.includes("new ") && !trimmedLine.includes("delete")) {
            addError(
                outline,
                "MemoryError",
                "Potential memory leak. Remember to delete dynamically allocated memory.",
                index + 1,
                line.indexOf("new") + 1
            );
        }

        // Check for use of deprecated features
        if (trimmedLine.includes("auto_ptr")) {
            addError(
                outline,
                "DeprecationWarning",
                "auto_ptr is deprecated. Use unique_ptr instead.",
                index + 1,
                line.indexOf("auto_ptr") + 1
            );
        }

        // Check for variable declarations and usage
        const varDecl = trimmedLine.match(
            /\b(?:int|float|double|char|bool)\s+(\w+)/
        );
        if (varDecl) {
            declaredVars.add(varDecl[1]);
        }

        const varUsage = trimmedLine.match(/\b(\w+)\b/g);
        if (varUsage) {
            varUsage.forEach((v) => usedVars.add(v));
        }
    });

    // Check for unused variables
    declaredVars.forEach((v) => {
        if (!usedVars.has(v)) {
            addError(outline, "UnusedWarning", `Unused variable: ${v}`, 1, 1);
        }
    });

    return outline;
}

function notebookOutput() {
    var x = document.getElementById("notebook-block");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}