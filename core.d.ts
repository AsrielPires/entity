
type Arr<T> = T[] | T;
interface Dic<T = any> { [key: string]: T; }
type Primitive = string | number | boolean;
/**record */
export type Rec<I = number> = { id?: I; } & Dic<any>;
export type Recs<I = number> = Rec<Arr<I>>;
export interface Sort {
  f: string;
  d?: boolean;
}
export interface Selection {
  signal: '+' | '-';
  id: number;
}
export interface SelectionFilter {
  /**filter by selection id */
  id?: string[];
  /**includes */
  in?: number[];
  /**excludes */
  ex?: number[];
  /**get records */
  full?: boolean
}
export interface SelectRowsResult {
  /**total */
  t: number;
  /**data */
  d: Array<Rec>;
}

export interface SelectResult {
  one: Primitive;
  row: Rec;
  col: Primitive[];
  rows: Rec[];
  full: SelectRowsResult;
}
/**get type */
export type GT = "one" | "row" | "col" | "rows" | "full";

export type InsertResult = Rec;
export type Value = string | number | Date | boolean;
export type Where = string | Value[] | Dic<Value>;
export interface IWhere {
  where?: Where;
  query?: string;
  queryBy?: Array<string>;
  groupBy?: Array<string>;
}
export interface FieldData {
  key: string;
  sub?: string[];
}
//used to get sub table
export interface SelectFieldData extends FieldData, Partial<ISelect<"row">> {
  subq?: boolean;
  where?: Dic<string>;
}
//used to get super table
export interface FkFieldData extends FieldData, ISelect<"rows" | "row"> {
  where?: Dic<string>;
}

export type BField = string | FieldData | SelectFieldData | FkFieldData;
export interface ISelect<T extends GT = "rows"> extends IWhere {
  tp?: T;
  fields?: Array<BField>;
  params?: Dic<string>;
  sort?: Array<Sort | string>;
  tags?: Array<Selection>;
  /**if shoul get id @default true */
  id?: boolean;
  pag?: number;
  limit?: number;
  fill?: boolean;
}