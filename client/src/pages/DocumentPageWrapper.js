import React from 'react';
import { useParams } from 'react-router-dom';
import DocumentPage from './DocumentPage';

// Extrait l'id depuis l'URL et le passe à DocumentPage
export default function DocumentPageWrapper() {
  const { id } = useParams();
  return <DocumentPage documentId={id} />;
}
