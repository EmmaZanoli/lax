import type { Buyer } from './types';

/**
 * Buyer di esempio, usati SOLO in sviluppo e SOLO al primo avvio (vedi bootstrap).
 * Il catalogo di default arriva invece da /catalog.json.
 * Il prodotto 106 (Pepparkakor) è volutamente SCOPERTO: ordinato 18 > giacenza 15,
 * così da poter provare la segnalazione di ammanco.
 */

export const seedBuyers: Buyer[] = [
  {
    id: 'b1',
    name: 'Anna Bergström',
    phone: '333 1112221',
    order: { 101: 2, 104: 1, 106: 3 },
    pickedUp: true,
    payment: 'cash',
  },
  {
    id: 'b2',
    name: 'Marco Rossi',
    phone: '347 2223331',
    order: { 102: 4, 106: 2 },
    pickedUp: true,
    payment: 'received',
  },
  {
    id: 'b3',
    name: 'Lena Öberg',
    phone: '340 5556667',
    order: { 103: 5, 105: 1 },
    pickedUp: false,
    payment: 'none',
  },
  {
    id: 'b4',
    name: 'Giulia Conti',
    order: { 101: 1, 102: 2, 106: 4 },
    pickedUp: true,
    payment: 'pending',
  },
  {
    id: 'b5',
    name: 'Erik Lund',
    phone: '331 4445556',
    order: { 104: 3, 106: 2 },
    pickedUp: true,
    payment: 'none', // ritirato ma non ancora pagato
  },
  {
    id: 'b6',
    name: 'Sofia Ricci',
    order: { 105: 2, 103: 2 },
    pickedUp: false,
    payment: 'none',
  },
  {
    id: 'b7',
    name: 'Johan Nilsson',
    phone: '328 7778889',
    order: { 101: 3, 106: 3 },
    pickedUp: true,
    payment: 'cash',
  },
  {
    id: 'b8',
    name: 'Chiara Greco',
    phone: '349 9990001',
    order: { 102: 1, 104: 2, 106: 2 },
    pickedUp: false,
    payment: 'none',
  },
  {
    id: 'b9',
    name: 'Paolo Ferrari',
    order: { 103: 4, 105: 3 },
    pickedUp: true,
    payment: 'received',
  },
  {
    id: 'b10',
    name: 'Karin Ax',
    phone: '351 2340012',
    order: { 101: 2, 106: 2 },
    pickedUp: true,
    payment: 'pending',
  },
];
