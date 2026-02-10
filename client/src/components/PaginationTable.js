// src/components/PaginationTable.js
// Table MUI avec Pagination intégrée pour listes longues.

import React from 'react';
import { Table, TableHead, TableRow, TableCell, TableBody, TablePagination } from '@mui/material';

export default function PaginationTable({ columns, rows, page, rowsPerPage, onPageChange, onRowsPerPageChange }) {
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0;

  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map(col => <TableCell key={col.field}>{col.headerName}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, idx) => (
            <TableRow key={idx}>
              {columns.map(col => <TableCell key={col.field}>{row[col.field]}</TableCell>)}
            </TableRow>
          ))}
          {emptyRows > 0 && (
            <TableRow style={{ height: 53 * emptyRows }}>
              <TableCell colSpan={columns.length} />
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </>
  );
}
