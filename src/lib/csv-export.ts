
/**
 * Converts an array of objects to a CSV string
 * 
 * @param data Array of objects to convert to CSV
 * @param columns Optional column configuration with headers
 * @returns CSV string
 */
export function objectsToCSV(
  data: Record<string, any>[],
  columns?: { key: string; header: string }[]
): string {
  if (!data || !data.length) return '';
  
  // If columns aren't specified, use the keys from the first object
  const keys = columns?.map(col => col.key) || Object.keys(data[0]);
  const headers = columns?.map(col => col.header) || keys;
  
  // Create CSV header row
  const csvContent = [
    headers.join(','),
    ...data.map(row => {
      return keys.map(key => {
        const value = row[key];
        // Handle cases where values might contain commas or quotes
        if (value === null || value === undefined) {
          return '""';
        }
        const cellValue = String(value).replace(/"/g, '""');
        return `"${cellValue}"`;
      }).join(',');
    })
  ].join('\n');
  
  return csvContent;
}

/**
 * Triggers a download of a CSV file in the browser
 * 
 * @param csvContent CSV content as a string
 * @param filename Name for the downloaded file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  // Create a download link
  // Check for IE-specific saveBlob method - using type assertion to avoid TypeScript error
  if (navigator && 'msSaveBlob' in navigator) {
    // IE 10+
    (navigator as any).msSaveBlob(blob, filename);
  } else {
    // Other browsers
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Combined function to export data to CSV and trigger download
 * 
 * @param data Array of objects to export
 * @param filename Name for the downloaded file
 * @param columns Optional column configuration with headers
 */
export function exportToCSV(
  data: Record<string, any>[],
  filename: string,
  columns?: { key: string; header: string }[]
): void {
  const csvContent = objectsToCSV(data, columns);
  downloadCSV(csvContent, filename);
}
