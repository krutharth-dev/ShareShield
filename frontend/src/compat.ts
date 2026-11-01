/**
 * PDF.js 6 uses recently-standardized Map getOrInsert* methods that some
 * supported browsers still lack. Install these before lazy-loading PDF.js.
 * Do not mutate already native implementations.
 */
type AnyMap=Map<unknown,unknown>;
type MapInsert=AnyMap&{
 getOrInsert?:(key:unknown,value:unknown)=>unknown;
 getOrInsertComputed?:(key:unknown,callback:(key:unknown)=>unknown)=>unknown;
};
const proto=Map.prototype as MapInsert;
if(typeof proto.getOrInsert!=='function'){
 Object.defineProperty(Map.prototype,'getOrInsert',{
  configurable:true,writable:true,value:function(this:AnyMap,key:unknown,value:unknown){
   if(this.has(key))return this.get(key);
   this.set(key,value);return value;
  }
 });
}
if(typeof proto.getOrInsertComputed!=='function'){
 Object.defineProperty(Map.prototype,'getOrInsertComputed',{
  configurable:true,writable:true,value:function(this:AnyMap,key:unknown,callback:(key:unknown)=>unknown){
   if(this.has(key))return this.get(key);
   const value=callback(key);
   // A callback may itself insert a value: preserve that deliberate result.
   if(this.has(key))return this.get(key);
   this.set(key,value);return value;
  }
 });
}
// Keep WeakMap caches compatible with the same PDF.js runtime expectations.
type AnyWeakMap=WeakMap<object,unknown>;
const weak=WeakMap.prototype as AnyWeakMap&{getOrInsert?:(key:object,value:unknown)=>unknown;getOrInsertComputed?:(key:object,cb:(key:object)=>unknown)=>unknown;};
if(typeof weak.getOrInsert!=='function'){
 Object.defineProperty(WeakMap.prototype,'getOrInsert',{
  configurable:true,writable:true,value:function(this:AnyWeakMap,key:object,value:unknown){
   if(this.has(key))return this.get(key);this.set(key,value);return value;
  }
 });
}
if(typeof weak.getOrInsertComputed!=='function'){
 Object.defineProperty(WeakMap.prototype,'getOrInsertComputed',{
  configurable:true,writable:true,value:function(this:AnyWeakMap,key:object,callback:(key:object)=>unknown){
   if(this.has(key))return this.get(key);
   const value=callback(key);if(this.has(key))return this.get(key);
   this.set(key,value);return value;
  }
 });
}
export {};
