export interface PackageJson {
    [key: string]: Maybe<boolean | string | string[] | Collection<string, string>>

    name?: string
    version?: string
    private?: boolean
    license?: string
    main?: string
    scripts?: Collection<string, string>
    dependencies?: Collection<string, string>
    devDependencies?: Collection<string, string>
    peerDependencies?: Collection<string, string>
}

export interface Options {
    debug?: boolean
    additionalDependencies?: { [key: string]: string }
    excludeDependencies?: string[]
    fileName?: string
}
