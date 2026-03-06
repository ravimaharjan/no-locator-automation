import xlsx from 'xlsx';
/**
 * Reads an Excel file and converts the first sheet to an array of objects
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<Array<Object>>} - Array of objects with data
 */
export async function readExcelData(filePath) {
    // Read the Excel file

    const workbook = xlsx.readFile(filePath);
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Find the actual last row and column with data
    let lastRow = 0;
    let lastCol = 0;

    for (const cellRef in worksheet) {
        if (cellRef[0] === '!') continue; // Skip special properties
        const cell = xlsx.utils.decode_cell(cellRef);
        if (cell.r > lastRow) {
            lastRow = cell.r;
        }
        if (cell.c > lastCol) {
            lastCol = cell.c;
        }
    }

    // Use the actual last row and column for the range
    const dataRange = {
        s: { r: 0, c: 0 }, // Start from first cell
        e: { r: lastRow, c: lastCol }, // End at actual last row and column with data
    };

    // Convert only the range with actual data
    const jsonData = xlsx.utils.sheet_to_json(worksheet, {
        header: 1, // Get array of arrays including headers
        defval: '', // Default value for empty cells
        raw: false,
        blankrows: false,
        range: dataRange,
    });

    if (jsonData.length <= 1) {
        return new []; // No data rows
    }

    const headers = jsonData[0];

    // Filter out empty rows and convert remaining rows to objects using headers as keys
    let data = jsonData.slice(1).map((row) => {
        const rowData = {};
        headers.forEach((header, index) => {
            if (header) {
                // Only include columns with headers
                rowData[header] = row[index] || '';
            }
        });
        return rowData;
    });

    return data
}