#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import consola from 'consola'
import { detectPackageManager } from 'nypm'
import { $ as $$ } from 'execa'

const $ = $$({ shell: true })

function findParseJson(path: string) {
    if (!existsSync(path)) {
        throw new Error(`File not found: ${path}`)
    }
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
}

const packageJson = findParseJson(join(process.cwd(), 'package.json'))

function isMonorepoRoot(path: string) {
    if (packageJson.workspaces) {
        return true
    }
    for (const file of ['lerna.json', 'pnpm-workspace.yaml']) {
        if (existsSync(join(path, file))) {
            consola.info(`Detected monorepo root by ${file}`)
            return true
        }
    }
    return false
}

const cwd = process.cwd()
const isRoot = isMonorepoRoot(cwd)

if (!packageJson.devDependencies['@akrc/tsconfig']) {
    const pm = await detectPackageManager(cwd)
    consola.info(`Detected package manager: ${pm?.name}`)
    switch (pm?.name) {
        case 'npm':
            await $`npm install --save-dev @akrc/tsconfig`
            break
        case 'pnpm':
            await $`pnpm add -D @akrc/tsconfig ${isRoot ? '-w' : ''}`
            break
        case 'yarn':
            await $`yarn add -D @akrc/tsconfig`
            break
        default:
            throw new Error('Unknown package manager')
    }
}

const tsconfigPath = isRoot
    ? join(cwd, 'tsconfig.base.json')
    : join(cwd, 'tsconfig.json')

if (existsSync(tsconfigPath)) {
    const confirmed = await consola.prompt(
        `${basename(tsconfigPath)} already exists, do you want to overwrite it?`,
        {
            type: 'confirm',
            initial: false,
        },
    )
    if (!confirmed) {
        consola.fatal('Aborted.')
        process.exit(0)
    }
} else {
    consola.info('Creating tsconfig.json...')
}

const type = isRoot
    ? 'node'
    : await consola.prompt('Please select project type', {
          type: 'select',
          initial: 'node',
          options: ['node', 'react', 'vue', 'web'],
      })

writeFileSync(
    tsconfigPath,
    JSON.stringify(
        {
            extends: `@akrc/tsconfig/${type}.json`,
        },
        null,
        2,
    ),
)
consola.success('tsconfig.json created.')
