// Pedaços de schema repetidos em várias rotas.
export const seguranca = [{ bearerAuth: [] }];
export const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 36, maxLength: 36 } } };
export const versao = { type: 'integer', minimum: 1 };
export const versaoQuery = { type: 'object', required: ['versao'], properties: { versao } };

// Arthur Oliver Rossi Alves, autor do Greencode.
