import { inspect } from 'util'
import { builtinModules } from 'module'
import { type Compiler, type WebpackPluginInstance, Compilation, sources } from 'webpack'
import { getInstalledVersion, getNameFromPortableId, orderByKeys } from './utils'
import type { PackageJson, Options } from './types'

const pluginName = 'GeneratePackageJsonPlugin'

export class GeneratePackageJsonPlugin implements WebpackPluginInstance {
	private readonly modules: Collection<string, string>
	private options: Required<Options>

	constructor(
		private basePackage: PackageJson = {
			name: 'generated-package-json',
			version: '0.0.1'
		},
		options: Options = {}
	) {
		if (options.debug) console.info(`GeneratePackageJsonPlugin: Debugging mode activated!`)

		this.options = {
			debug: false,
			additionalDependencies: {},
			excludeDependencies: [],
			fileName: 'package.json',
			...options
		}
		this.modules = { ...options.additionalDependencies }
	}

	public apply(compiler: Compiler) {
		compiler.hooks.thisCompilation.tap(pluginName, compilation => {
			compilation.hooks.processAssets.tap(
				{ name: pluginName, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
				() => this.emitPackageJson(compilation)
			)
		})
	}

	private emitPackageJson(compilation: Compilation) {
		compilation.emitAsset(
			this.options.fileName,
			new sources.RawSource(this.computePackageJson(compilation))
		)
	}

	private computePackageJson(compilation: Compilation) {
		this.processWebpackModules(compilation)
		this.processNonWebpackModules()

		this.log(`GPJWP: Modules to be used in generated package.json`, this.modules)

		return JSON.stringify(
			{ ...this.basePackage, dependencies: orderByKeys(this.modules) },
			null,
			4
		)
	}

	private processWebpackModules(compilation: Compilation) {
		compilation.modules.forEach(module => {
			const portableId = module.identifier()

			if (portableId.indexOf('external ') === -1) {
				return this.log(`GPJWP: Found module: ${portableId}`)
			}

			const moduleName = getNameFromPortableId(portableId)
			this.log(`GPJWP: Found external module: ${portableId}`)

			if (['.', '..'].includes(moduleName)) {
				return this.log(`GPJP: excluded "${portableId}" because it is on a relative path`)
			}

			if (this.options.excludeDependencies.includes(moduleName)) {
				return this.log(`GPJWP: excluded "${moduleName}" from generated package.json`)
			}

			if (moduleName.length === 0) {
				return console.error(
					`GPJWP: Couldn't decipher the module name from external module input: ${portableId} - will be ignored in final output.`
				)
			}

			if (builtinModules.indexOf(moduleName) !== -1) {
				return this.log(`GPJWP: Native node.js module detected: ${portableId}`)
			}

			const moduleIssuer = compilation.moduleGraph.getIssuer(module)
			const moduleVersion = getInstalledVersion(moduleName, moduleIssuer?.context)

			if (moduleVersion) this.modules[moduleName] = moduleVersion
			else {
				console.error(
					`GPJWP: Couldn't resolve a version for module "${moduleName}" (from portable ID: ${portableId}) - will be ignored in final output.`
				)
			}
		})
	}

	private processNonWebpackModules() {
		const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const
		const basePackageValues = { ...this.basePackage }

		dependencyTypes.forEach(dependencyType => {
			const dependencies = basePackageValues[dependencyType] ?? {}

			Object.keys(dependencies).forEach(moduleName => {
				const version = dependencies?.[moduleName]

				if (version) {
					this.log(
						`GPJWP: Adding deliberate module in "${dependencyType}" with version set deliberately: ${moduleName} -> ${version}`
					)

					if (dependencyType === 'dependencies') this.modules[moduleName] = version
				} else {
					const installedVersion = getInstalledVersion(moduleName)

					if (!installedVersion) {
						return console.warn(
							`GPJWP: Couldn't find installed version for module "${moduleName}" - falling back to extra source package version map (if provided)`
						)
					}

					if (dependencyType !== 'dependencies') {
						dependencies[moduleName] = installedVersion
						delete this.modules[moduleName]
					} else {
						this.modules[moduleName] = installedVersion
					}
				}
			})
		})
	}

	private log(message: string, meta: unknown = '') {
		if (!this.options.debug) return

		if (meta) console.info(message, inspect(meta, { depth: 3 }))
		else console.info(message)
	}
}
