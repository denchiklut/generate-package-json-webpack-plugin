import { join, sep } from 'path'
import { readFileSync } from 'fs'

export function getNameFromPortableId(raw: string) {
	const nodeModulesPart = 'node_modules'

	if (raw.indexOf('javascript/esm') >= 0) {
		const nodeModulesLastIndex = raw.lastIndexOf(nodeModulesPart)

		if (nodeModulesLastIndex >= 0) {
			const mainModulePart = raw.slice(nodeModulesLastIndex + nodeModulesPart.length + 1)
			const firstSlashIndex = mainModulePart.indexOf(sep)

			if (mainModulePart.startsWith('@')) {
				const secondSlashIndex = mainModulePart.indexOf(sep, firstSlashIndex + 1)

				if (secondSlashIndex >= 0) {
					return `${mainModulePart.slice(0, firstSlashIndex)}/${mainModulePart.slice(
						firstSlashIndex + 1,
						secondSlashIndex
					)}`
				} else {
					return `${mainModulePart.slice(0, firstSlashIndex)}/${mainModulePart.slice(
						firstSlashIndex + 1
					)}`
				}
			} else {
				if (firstSlashIndex >= 0) return mainModulePart.slice(0, firstSlashIndex)
				else return mainModulePart
			}
		} else {
			return ''
		}
	}

	let cut = raw.substring(raw.indexOf('"') + 1, raw.lastIndexOf('"'))

	let slashCount = (cut.match(/\//g) || []).length

	while ((cut.indexOf('@') === -1 && slashCount > 0) || slashCount > 1) {
		cut = cut.substring(0, cut.lastIndexOf('/'))
		slashCount -= 1
	}

	return cut
}

function resolveModuleBasePath(moduleName: string, options?: object) {
	let moduleMainFilePath

	try {
		moduleMainFilePath = require.resolve(moduleName, options)
	} catch (e) {
		const error = e as Error
		const searchErrorNoExportsPart = `No "exports" main defined in `
		const packageJsonPart = 'package.json'
		const message = error.message ? error.message : ''
		const indexOfMessage = message.lastIndexOf(searchErrorNoExportsPart)
		const indexOfPackage = message.lastIndexOf(packageJsonPart)

		if (indexOfMessage >= 0 && indexOfPackage >= 0) {
			moduleMainFilePath = error.message.slice(
				indexOfMessage + searchErrorNoExportsPart.length,
				indexOfPackage + packageJsonPart.length
			)
		} else {
			throw error
		}
	}

	const moduleNameParts = moduleName.split('/')
	let searchForPathSection: Nullable<string>

	if (moduleName.startsWith('@') && moduleNameParts.length > 1) {
		const [org, module] = moduleNameParts
		searchForPathSection = `node_modules${sep}${org}${sep}${module}`
	} else {
		const [module] = moduleNameParts
		searchForPathSection = `node_modules${sep}${module}`
	}

	const lastIndex = moduleMainFilePath.lastIndexOf(searchForPathSection)

	if (lastIndex === -1) {
		throw new Error(
			`Couldn't resolve the base path of "${moduleName}". Searched inside the resolved main file path "${moduleMainFilePath}" using "${searchForPathSection}"`
		)
	}

	return moduleMainFilePath.slice(0, lastIndex + searchForPathSection.length)
}

export function getInstalledVersion(moduleName: string, context?: Nullable<string>) {
	let modulePackageFile
	const resolveFile = join(moduleName, 'package.json')

	try {
		const moduleBasePath = resolveModuleBasePath(
			moduleName,
			context ? { paths: [context] } : undefined
		)

		modulePackageFile = join(moduleBasePath, './package.json')
	} catch {
		console.error(
			`GPJWP: Ignoring module without a found package.json: ${moduleName} ("${resolveFile}" couldn't resolve)`
		)

		return null
	}

	let version: Nullable<string> = null

	try {
		version = JSON.parse(readFileSync(modulePackageFile).toString()).version
	} catch {
		throw new Error(`Can't parse package.json file: ${modulePackageFile}`)
	}

	if (!version) throw new Error(`Missing package.json version: ${modulePackageFile}`)

	return version
}

export function orderByKeys<T>(obj: T): T {
	if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
		return obj
	}

	return Object.keys(obj)
		.sort()
		.reduce(
			(result, key) => ({
				...result,
				[key]: obj[key as keyof T]
			}),
			{}
		) as T
}
