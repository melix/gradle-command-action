import * as exec from '@actions/exec'
import * as cacheDependencies from './cache-dependencies'
import * as cacheConfiguration from './cache-configuration'
import * as artifact from '@actions/artifact'
import * as fs from 'fs'
import * as github from './github-utils'
import * as path from 'path'
import * as core from '@actions/core'

export async function execute(
    executable: string,
    root: string,
    argv: string[]
): Promise<BuildResult> {
    await cacheDependencies.restoreCachedDependencies(root)
    await cacheConfiguration.restoreCachedConfiguration(root)

    let publishing = false
    let buildScanUrl: string | undefined

    const status: number = await exec.exec(executable, argv, {
        cwd: root,
        ignoreReturnCode: true,
        listeners: {
            stdline: (line: string) => {
                if (line.includes('Publishing build scan...')) {
                    publishing = true
                }
                if (publishing && line.startsWith('http')) {
                    buildScanUrl = line.trim()
                    publishing = false
                }
            }
        }
    })

    await uploadResolvedDependencies(root)

    return new BuildResultImpl(status, buildScanUrl)
}

async function uploadResolvedDependencies(
    baseDirectory: string
): Promise<void> {
    if (github.inputBoolean('export-resolved-dependencies')) {
        const jsonFile = path.resolve(
            baseDirectory,
            'resolved-dependencies.json'
        )
        if (fs.existsSync(jsonFile)) {
            core.info('Uploading resolved dependencies artifact')
            const upload = artifact.create()
            await upload.uploadArtifact(
                'Resolved dependencies',
                [jsonFile],
                baseDirectory
            )
        } else {
            core.info(`Resolved dependencies file ${jsonFile} not found`)
        }
    }
}

export interface BuildResult {
    readonly status: number
    readonly buildScanUrl?: string
}

class BuildResultImpl implements BuildResult {
    constructor(readonly status: number, readonly buildScanUrl?: string) {}
}
