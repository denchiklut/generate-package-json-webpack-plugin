declare type Maybe<T> = T | null | undefined
declare type Nullable<T> = T | null
declare type Collection<TypeId extends string | number | symbol, T> = Record<TypeId, T>
declare type Prettify<T> = { [K in keyof T]: T[K] }
