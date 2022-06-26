import { orray, setTag } from "orray";
const isA = (value: any): value is Array<any> => Array.isArray(value);
const isS = (value: any): value is string => typeof value === 'string';
import { L } from "orray";
import { BField, GT, InsertResult, ISelect, Rec, Selection, SelectResult, SelectRowsResult, Sort, Value } from "./core";
export { ISelect, IWhere, BField } from "./core";
type Key = string | number;
type Arr<T> = T[] | T;
type Task<T> = T | Promise<T>;
interface Dic<T = any> {
  [key: string]: T;
}
export const enum LinkType {
  processed = 0,
  raw = 1,
  sub = 2
}
export const enum FieldActionType {
  set = 1,
  get = 2,
}
declare global {
  namespace entity {
    interface Settings {
      limit: number;
      id(entity: Entity): string;
      linkTp?: LinkType;
      select?<T extends GT>(entity: string, bond: ISelect<T>): Task<SelectResult[T]>;
      insert?(entity: string, value: Arr<Rec>): Task<InsertResult>;
      update?(entity: string, value: Arr<Rec>): Task<any>;
      remove?(entity: string, value: Arr<Rec<Key[]>>): Task<any>;
      create?(key: string, i?: Partial<Entity>): Task<Entity>;
    }
    interface Entity {
      key?: string;
      /**bonds listeners */
      bonds?: Array<Bond>;
      react?: Array<string>;
      actions?: Array<Action>;
      fields?: Field[];


      main?: string;
      icon?: string;
    }
    interface FieldType {
      dt?: DataType;
      init?(f: Field, tp: FieldActionType): Task<void>;
    }
    interface Field {
      key: string;
      tp?: Key;
      get?: boolean;
      set?: boolean;
      sort?: boolean;
      req?: boolean;
      query?: boolean;
    }
  }
}
export type Entity = entity.Entity;
export type FieldType = entity.FieldType;
export type Field = entity.Field;
export const enum DataType {
  string = "s",
  dateTime = "d",
  boolean = "b",
  number = "n"
}
export interface Action {
  key: string;
  call(...args: any[]): any;
}
export const $: entity.Settings = {
  limit: 50,
  id: () => "id"
};
export function bind(ent: Entity, bond: Bond) {
  if ((ent.bonds ||= []).includes(bond))
    console.warn("already binded");
  else
    ent.bonds.push(bond);
  return ent;
};
export function unbind(ent: Entity, bond: Bond) {
  if (ent.bonds) {
    let i = ent.bonds.indexOf(bond);
    (i != -1) && ent.bonds.splice(i, 1);
  }
}

export const fieldTypes: Dic<FieldType> = {};
export const ftype = ({ tp }: Field) => fieldTypes[tp];
export function field(ent: Entity, key: string | ((f: Field) => any)) {
  let r = ent.fields.find(isS(key) ? (f) => f.key == key : key);
  return r;
}
export function fields(ent: Entity, filter?: (field: Field) => any) {
  let field = filter ? ent.fields.filter(filter) : ent.fields;
  return field;
}
export async function initFields(fields: entity.Field[], tp: FieldActionType) {
  for (let field of fields)
    await fieldTypes[field.tp].init?.(field, tp);
  return fields;
}
export function reactTo(ent: Entity, target: Entity) {
  (target.react ||= []).push(ent.key);
  return ent;
}
const key = (ent: Entity | string) => isS(ent) ? ent : ent.key;
export function select<T extends GT = "rows">(ent: Entity | string, bond: ISelect<T> = {}): Task<SelectResult[T]> {
  return $.select(key(ent), bond);
}
export async function insert(ent: Entity | string, values: Arr<Rec>) {
  let k = key(ent), result = await $.insert(k, values);
  reload(k);
  return result;
}
export async function update(ent: Entity | string, values: Arr<Rec>) {
  let k = key(ent), result = await $.update(k, values);
  reload(k);
  return result;
}
export async function remove(ent: Entity | string, ids: Key[]) {
  let k = key(ent), result = await $.remove(k, { id: ids });
  reload(k);
  return result;
}
async function reload(ent: string, reloaded = []) {
  let t = await entities[ent];
  if (t) {
    let l = t.bonds.length, t1 = Array(l);
    for (let i = 0; i < l; i++)
      t1[i] = t.bonds[i].select();
    reloaded.push(ent);
    if (t.react)
      for (let key of t.react)
        !reloaded.includes(key) && reload(key, reloaded);

    // return Promise.all(t1);
  }
}
const delay = 500;
interface BondOptions extends ISelect {
  readOnly?: boolean;
}
export class Bond implements ISelect<"full">{
  private _q: string;
  private _pag: number;
  private _limit: number;
  private _callindex;
  list: L<Rec>;
  readOnly: boolean;
  length: number;
  readonly fromStorage: (this: this, value: Dic) => Rec;
  readonly toStorage: (this: this, value: Rec) => Rec;
  readonly target: Entity;
  all: boolean;
  readonly groupBy: L<string>;
  readonly sort: L<Sort, string>;
  readonly queryBy: L<string>;
  readonly fields: L<BField>;
  readonly tags: L<Selection>;
  where: Dic<Value> | Value[];
  constructor(e: Entity, opts: BondOptions | string[] = {}) {
    isA(opts) && (opts = { fields: opts });
    this.target = e;
    this.readOnly = opts.readOnly;
    this._limit = opts.limit == null ? $.limit : opts.limit;
    this._pag = opts.pag || 1;
    let onupd = () => {
      this._pag = 1;
      this.select(delay);
    };
    this.groupBy = orray(opts.groupBy);
    this.query = opts.query;
    this.sort = orray<Sort, string>(opts.sort, {
      parse: (e) => isS(e) ? { f: e } : e,
      key: 'f'
    }).onupdate(onupd);
    this.fields = orray(opts.fields).onupdate(() => this.select(delay));
    this.tags = orray(opts.tags).onupdate(onupd);
    this.queryBy = orray(opts.queryBy || fields(e, f => f.query).map(f => f.key)).onupdate(onupd);
    this.where = isS(opts.where) ? [opts.where] : opts.where;
  }
  get key() { return this.target.key; }
  get tp(): "full" { return "full"; }
  get pags() {
    return this.limit ? Math.ceil(this.length / this.limit) : 1;
  }
  get query() {
    return this._q;
  }
  set query(value) {
    if (value != this._q) {
      this._pag = 1;
      this._q = value;
      this.select(delay);
    }
  }
  get pag() {
    return this._pag;
  }
  set pag(value) {
    if (value < 1)
      value = 1;
    else if (value > this.pags)
      value = this.pags;
    if (this._pag == value)
      return;
    this._pag = value;
    this.select();
  }
  get limit() {
    return this._limit;
  }
  set limit(value) {
    if (this._limit == value)
      return;
    this._pag = value ?
      Math.ceil(this._limit * this._pag / value) :
      1;
    this._limit = value;
    this.select();
  }
  ids() {
    if (this.pags > 1) {
      let t = this.toJSON();
      return $.select(this.target.key, {
        tp: "col",
        fields: [$.id(this.target)],
        where: t.where,
        query: t.query,
        queryBy: t.queryBy,
        groupBy: t.groupBy
      }) as Task<number[]>;
    }
    else
      return this.list.map(f => f.id);
  }
  pushFilter(value: string) {
    if (isA(this.where))
      this.where.push(value);
    else
      this.addFilter(Array
        .from({ length: 4 })
        .map(() => Math.round(Math.random() * 15).toString(16))
        .join(''), value);
    return this;
  }
  getFilter(key: string) {
    return isA(this.where) ? null : this.where?.[key] || null;
  }
  removeFilter(filter: string) {
    let w = this.where;
    if (w) if (isA(w)) {
      let i = w.indexOf(filter);
      (i != -1) && w.splice(i, 1);
    } else delete w[filter];
    this.select(delay);
    return this;
  }
  addFilter(key: string, value: Value) {
    let w = this.where ||= {};
    if (isA(w)) {
      for (var r: Dic<Value> = {}, i = 0; i < w.length; i++)
        r[i] = w[i];
      w = r;
    }
    // let w = isA(this.where) ? arrToDic(this.where = this.where, (v, i) => ["" + i, v]) : this.where ||= {};
    // this.getFilter(key);
    if (w[key] == value) return;

    w[key] = value;
    this.select(delay);
    return this;
  }
  whereV() {
    let w = this.where;
    return w ? isA(w) ? w.slice() : Object.values(w) : [];
  }
  bind(list?: L<Rec>): L<Rec<number>, Rec<number>> {
    if (!this.list) {
      (this.list = list || orray()).key = 'id';
      bind(this.target, this);
      this.select();
    }
    return this.list;
  }
  private _handlers;
  async getAll(): Promise<Rec<number>[]> {
    return await $.select(this.target.key, Object.assign(this.toJSON(), {
      tp: undefined,
      limit: undefined,
      pag: undefined,
      total: undefined
    }));
  }
  select(): Promise<SelectRowsResult>;
  select(wait: number): this;
  select(wait?: number) {
    let fn = async () => {
      let tags = {}, groups = {}, list = this.list;
      if (list) {
        let data = await $.select(this.target.key, this);
        this.length = data.t;
        for (let key in list.tags)
          if (list.tags[key])
            tags[key] = list.tags[key].value.id;
        for (let key in list.g)
          groups[key] = list.g[key].keyField();
        list.set(data.d);
        for (let key in tags)
          setTag(list, key, tags[key]);
        for (let key in groups) {
          let group = groups[key];
          list.g[key].set(list.filter(i => group.indexOf(i.id) != -1));
        }
        if (this._handlers)
          for (let h of this._handlers)
            h(data);
        return data;
      }
    }
    clearTimeout(this._callindex);
    if (wait) { this._callindex = setTimeout(fn, wait); return this; }
    else return fn();
  }
  on(handler: (data: SelectRowsResult) => void) {
    this._handlers || (this._handlers = []).push(handler);
    return this;
  }
  toJSON(): ISelect<"full"> {
    let { query: q, queryBy: b, fields: f, where: w, sort: s, target: t } = this;
    return {
      tp: "full",
      fields: !f.length || t.fields.length == f.length ? undefined : f,
      where: w && (isA(w) ? w : Object.values(w)),
      limit: this.limit,
      pag: this.pag,
      query: q && b ? q : undefined,
      queryBy: q && b ? b : undefined,
      sort: s.length ? s : undefined,
      // total: true
    };
  }
}
export function createBond(src: string, fields?: string[]): Promise<Bond>;
export function createBond(src: IBond): Promise<Bond>;
export async function createBond(src: IBond | string, fields?: string[]) {
  fields && (src = { key: src as string, fields });
  return new Bond(await entity(src), isS(src) ? void 0 : src);
}
export interface IBond<T extends GT = "rows"> extends ISelect<T> {
  key: string;
}
const entities: Dic<Entity | Promise<Entity>> = {};

export function entity(key: string | IBond<any>): Task<Entity>;
export function entity(key: string | IBond<any>, fields: Field[], i?: Partial<Entity>): Entity;
export function entity(key: string | IBond<any>, i: Entity): Entity;
export function entity(key: string | IBond<any>, f?: Entity | Field[], i?: Entity) {
  isS(key) || (key = key.key);

  if (f) {
    (key in entities) && console.error("alread inserted");
    isA(f) ?
      (i ||= {}).fields = f :
      i = f;
    i.key = key;
    return entities[key] = i;
  }
  if (key in entities) return entities[key];
  return (entities[key] = Promise.resolve($.create ? $.create(key, i) : i)).then(v => entities[v.key = key as string] = v);
}
// export const entitySync = (key: string | IBond) => entities[isS(key) ? key : key.key];