// Function to read the file and return its contents
function readFile(fileInput) {
    return new Promise((resolve, reject) => {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);

        reader.readAsText(file);
    });
}

// Main function to process files and generate output
async function processFiles() {
    // Get input and optab files
    const inputFile = document.getElementById("inputFile");
    const optabFile = document.getElementById("optabFile");

    try {
        // Read files
        const inputContent = await readFile(inputFile);
        const optabContent = await readFile(optabFile);

        // Parse input and optab content
        const inputProgram = parseInputFile(inputContent);
        const optab = parseOptabFile(optabContent);

        // Generate symbol table in Pass 1
        const symbolTable = generateSymbolTable(inputProgram);

        // Generate final output and record file in Pass 2
        const finalOutput = generateFinalOutput(inputProgram, optab, symbolTable);
        const recordFile = generateRecordFile(inputProgram, optab, symbolTable);

        // Display the output
        document.getElementById("finalOutput").textContent = finalOutput;
        document.getElementById("recordFile").textContent = recordFile;

    } catch (error) {
        alert('Error reading files: ' + error);
    }
}

// Function to parse the input file (assembly program)
function parseInputFile(input) {
    const lines = input.split('\n').map(line => line.trim()).filter(line => line);
    return lines.map(line => {
        const parts = line.split(/\s+/);
        return {
            label: parts[0] !== '-' ? parts[0] : '',
            instruction: parts[1],
            operand: parts[2] || ''
        };
    });
}

// Function to parse the optab file (opcode table)
function parseOptabFile(optab) {
    const lines = optab.split('\n').map(line => line.trim()).filter(line => line);
    const optabMap = {};
    lines.forEach(line => {
        const [instruction, opcode] = line.split(/\s+/);
        optabMap[instruction] = opcode;
    });
    return optabMap;
}

// Pass 1: Function to generate the symbol table
function generateSymbolTable(inputProgram) {
    let locctr = 0;
    const symbolTable = {};

    inputProgram.forEach(line => {
        if (line.instruction === 'START') {
            locctr = parseInt(line.operand, 16); // Set LOCCTR to the operand of the START directive
        } else {
            if (line.label) {
                symbolTable[line.label] = locctr.toString(16).toUpperCase();
            }

            // Increment LOCCTR based on instruction type
            switch (line.instruction) {
                case 'BYTE':
                    locctr += (line.operand.length - 3); // length of 'C'' strings minus delimiters
                    break;
                case 'WORD':
                    locctr += 3;
                    break;
                case 'RESB':
                    locctr += parseInt(line.operand);
                    break;
                case 'RESW':
                    locctr += 3 * parseInt(line.operand);
                    break;
                default:
                    locctr += 3; // assuming each instruction takes 3 bytes
            }
        }
    });

    return symbolTable;
}

// Pass 2: Function to generate final output with machine code
function generateFinalOutput(inputProgram, optab, symbolTable) {
    let locctr = 0;
    let output = '';

    inputProgram.forEach(line => {
        let machineCode = '';
        let address = '';

        if (line.instruction === 'START') {
            locctr = parseInt(line.operand, 16); // Set LOCCTR to START operand
            output += `${locctr.toString(16).toUpperCase().padStart(4, '0')}  ${line.label.padEnd(5, ' ')}  ${line.instruction.padEnd(5, ' ')}  ${line.operand.padEnd(5, ' ')}\n`;
        } else {
            if (optab[line.instruction] !== undefined) {
                machineCode = optab[line.instruction];
                // Use the symbol table to resolve addresses
                if (line.operand && symbolTable[line.operand]) {
                    address = symbolTable[line.operand];
                }
            }

            output += `${locctr.toString(16).toUpperCase().padStart(4, '0')}  ${line.label.padEnd(5, ' ')}  ${line.instruction.padEnd(5, ' ')}  ${line.operand.padEnd(5, ' ')}  ${machineCode.padEnd(2, ' ')} ${address}\n`;

            // Increment LOCCTR based on instruction type
            switch (line.instruction) {
                case 'BYTE':
                    locctr += (line.operand.length - 3); // length of 'C'' strings minus delimiters
                    break;
                case 'WORD':
                    locctr += 3;
                    break;
                case 'RESB':
                    locctr += parseInt(line.operand);
                    break;
                case 'RESW':
                    locctr += 3 * parseInt(line.operand);
                    break;
                default:
                    locctr += 3; // assuming each instruction takes 3 bytes
            }
        }
    });

    return output;
}

// Function to generate record file (based on input program, optab, and symbol table)
// Function to generate record file (based on input program, optab, and symbol table)
function generateRecordFile(inputProgram, optab, symbolTable) {
    const startAddress = '001000'; // Starting address as 1000
    let locctr = parseInt(startAddress, 16); // Start LOCCTR from 1000
    let lastAddress = locctr; // Track the last address after processing the input program

    // Text record construction
    let textRecord = `T^${startAddress}^`; // Initialize text record header
    inputProgram.forEach(line => {
        if (optab[line.instruction]) {
            let machineCode = optab[line.instruction];
            if (line.operand && symbolTable[line.operand]) {
                machineCode += symbolTable[line.operand].padStart(4, '0'); // Append address for operand
            }
            textRecord += machineCode + '^';
        }

        // Increment LOCCTR and update lastAddress
        switch (line.instruction) {
            case 'BYTE':
                locctr += (line.operand.length - 3); // length of 'C' strings minus delimiters
                break;
            case 'WORD':
                locctr += 3;
                break;
            case 'RESB':
                locctr += parseInt(line.operand);
                break;
            case 'RESW':
                locctr += 3 * parseInt(line.operand);
                break;
            default:
                locctr += 3; // assuming each instruction takes 3 bytes
        }

        lastAddress = locctr-6; // Update last address after each line
    });

    // Calculate program length
    let programLength = (lastAddress - parseInt(startAddress, 16)).toString(16).toUpperCase().padStart(2, '0');

    // Update text record length
    const textRecordLength = programLength; // Use calculated length for text record
    textRecord = `T^${startAddress}^${textRecordLength}^` + textRecord.slice(2); // Update text record with length

    // Head record
    let recordFile = `H^COPY^${startAddress}^${programLength.padStart(6, '0')}\n`;

    // Add text record
    recordFile += textRecord.slice(0, -1) + '\n'; // Remove trailing '^'

    // End record
    recordFile += `E^${startAddress}\n`;

    return recordFile;
}




