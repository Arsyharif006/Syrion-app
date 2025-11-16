import React, { useState } from 'react';
import { FiDownload, FiCheck } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { useLocalization } from '../contexts/LocalizationContext';

interface TableProps {
  headers: string[];
  rows: (string | number)[][];
}

export const Table: React.FC<TableProps> = ({ headers, rows }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const { t } = useLocalization();

  // Fungsi untuk membersihkan markdown formatting
  const cleanText = (text: string | number): string => {
    if (typeof text === 'number') return text.toString();
    return text.replace(/\*\*/g, '').trim();
  };

  // Fungsi untuk download ke Excel
  const downloadExcel = () => {
    setIsDownloading(true);

    try {
      // Bersihkan data
      const cleanedHeaders = headers.map(h => cleanText(h));
      const cleanedRows = rows.map(row => 
        row.map(cell => cleanText(cell))
      );

      // Gabungkan headers dan rows
      const data = [cleanedHeaders, ...cleanedRows];

      // Buat worksheet dari data
      const worksheet = XLSX.utils.aoa_to_sheet(data);

      // Set column width otomatis
      const columnWidths = cleanedHeaders.map((header, i) => {
        const maxLength = Math.max(
          header.length,
          ...cleanedRows.map(row => String(row[i] || '').length)
        );
        return { wch: Math.min(maxLength + 2, 50) }; // Max 50 characters
      });
      worksheet['!cols'] = columnWidths;

      // Buat workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

      // Generate filename dengan timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `table_data_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(workbook, filename);

      // Show success feedback
      setDownloadSuccess(true);
      setTimeout(() => {
        setDownloadSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error downloading Excel:', error);
      alert(t('failedDownloadExcel') || 'Failed to download Excel file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="relative">
      {/* Download Button */}
      <div className="flex justify-end mb-2">
   
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700/50 my-0 -mx-1 sm:mx-0">
        <table className="min-w-full divide-y-2 divide-gray-700 bg-gray-800 text-xs sm:text-sm">
          <thead className="bg-gray-900/70">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 font-medium text-white text-left"
                >
                  {cleanText(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-700/50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="whitespace-nowrap px-3 sm:px-4 py-2 sm:py-2.5 text-gray-300"
                  >
                    {cleanText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row Count Info */}
      <div className="mt-2 text-xs flex justify-between text-gray-400">
        {t('showing')} {rows.length} {rows.length === 1 ? t('row') : t('rows')}
        <button
          onClick={downloadExcel}
          disabled={isDownloading || downloadSuccess}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
            downloadSuccess
              ? 'bg-green-600 text-white cursor-default'
              : isDownloading
              ? 'bg-gray-600 text-gray-300 cursor-wait'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
          title={t('downloadExcel')}
        >
          {downloadSuccess ? (
            <>
              <FiCheck size={14} />
              <span>{t('downloaded')}</span>
            </>
          ) : isDownloading ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              <span>{t('downloading')}</span>
            </>
          ) : (
            <>
              <FiDownload size={14} />
              <span>xlsx</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};