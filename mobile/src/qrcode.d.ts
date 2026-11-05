declare module 'qrcode' {
  const QRCode: { create(text: string, options?: { errorCorrectionLevel?: string }): { modules: { size: number; get(row: number, col: number): number } } };
  export default QRCode;
}
