// filepath: /home/oleksandr/projects/api/my-api/types/receipt.ts
export type Item = { name: string; price: number };
export type Receipt = {
  store: string | null;
  date: Date | null;
  items: Item[];
  summ: number | null;
};
