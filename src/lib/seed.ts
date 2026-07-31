import type { Buyer } from './types';

/**
 * Buyer di esempio, usati SOLO in sviluppo e SOLO al primo avvio (vedi bootstrap).
 * Il catalogo di default arriva invece da /catalog.json.
 * Il prodotto 12 (Sill typ 4) è volutamente SCOPERTO: ordinato 18 > giacenza 15,
 * così da poter provare la segnalazione di ammanco.
 */

export const seedBuyers: Buyer[] = [
  {
    id: 'b1',
    name: 'Anna Bergström',
    phone: '333 1112221',
    order: { 1: 2, 10: 1, 12: 3 },
    pickedUp: true,
    payment: 'cash',
  },
  {
    id: 'b2',
    name: 'Marco Rossi',
    phone: '347 2223331',
    order: { 2: 4, 12: 2 },
    pickedUp: true,
    payment: 'received',
  },
  {
    id: 'b3',
    name: 'Lena Öberg',
    phone: '340 5556667',
    order: { 9: 5, 11: 1 },
    pickedUp: false,
    payment: 'none',
  },
  {
    id: 'b4',
    name: 'Giulia Conti',
    order: { 1: 1, 2: 2, 12: 4 },
    pickedUp: true,
    payment: 'pending',
  },
  {
    id: 'b5',
    name: 'Erik Lund',
    phone: '331 4445556',
    order: { 10: 3, 12: 2 },
    pickedUp: true,
    payment: 'none',
  },
  {
    id: 'b6',
    name: 'Sofia Ricci',
    order: { 11: 2, 9: 2 },
    pickedUp: false,
    payment: 'none',
  },
  {
    id: 'b7',
    name: 'Johan Nilsson',
    phone: '328 7778889',
    order: { 1: 3, 12: 3 },
    pickedUp: true,
    payment: 'cash',
  },
  {
    id: 'b8',
    name: 'Chiara Greco',
    phone: '349 9990001',
    order: { 2: 1, 10: 2, 12: 2 },
    pickedUp: false,
    payment: 'none',
  },
  {
    id: 'b9',
    name: 'Paolo Ferrari',
    order: { 9: 4, 11: 3 },
    pickedUp: true,
    payment: 'received',
  },
  {
    id: 'b10',
    name: 'Karin Ax',
    phone: '351 2340012',
    order: { 1: 2, 12: 2 },
    pickedUp: true,
    payment: 'pending',
  },
];
