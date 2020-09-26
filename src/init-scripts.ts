import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as core from '@actions/core'

export async function writeInitScript(): Promise<void> {
    const scriptPath = path.resolve(
        os.homedir(),
        '.gradle/init.d/resolved-dependencies.gradle'
    )
    if (fs.existsSync(scriptPath)) return

    fs.mkdir(path.resolve(os.homedir(), '.gradle/init.d'), function (mkerr) {
        if (mkerr) throw mkerr

        core.info('Writing init script')

        fs.writeFile(
            scriptPath,
            `import groovy.json.JsonGenerator
            import groovy.json.JsonOutput
            import groovy.transform.Canonical
            import groovy.transform.CompileStatic
            
            @CompileStatic
            void collectDependencies(Project p, Configuration cnf, Map<Project, ProjectSpec> output) {
                Set<String> deps = []
                cnf.incoming.resolutionResult.allComponents { ResolvedComponentResult it ->
                    if (it.id instanceof ModuleComponentIdentifier) {
                        deps.add(it.id.toString())
                    }
                }
                output[p].addConfiguration(new ConfigSpec(cnf.name, deps))
            }
            
            @CompileStatic
            void exportDependencies(File outDir, Map<String, ProjectSpec> result) {
                def generator = new JsonGenerator.Options()
                        .excludeFieldsByName("contentHash")
                        .excludeFieldsByName("originalClassName")
                        .addConverter(ConfigSpec) { [(it.name): it.resolvedDependencies] }
                        .addConverter(ProjectSpec) { [(it.project): it.configurations]}
                        .build()
                def json = generator.toJson(result.values())
                def jsonFile = new File(outDir, "resolved-dependencies.json")
                jsonFile.text = JsonOutput.prettyPrint(json)
            }
            
            @CompileStatic
            @Canonical
            class ProjectSpec {
                final String project
                final List<ConfigSpec> configurations = []
            
                void addConfiguration(ConfigSpec spec) {
                    synchronized (configurations) {
                        configurations.add(spec)
                    }
                }
            }
            
            @CompileStatic
            @Canonical
            class ConfigSpec {
                final String name
                final Set<String> resolvedDependencies
            }
            
            
            def out = [:]
            
            allprojects { p ->
                out[p] = new ProjectSpec(p.path)
                p.configurations.all { cnf ->
                    cnf.incoming.afterResolve {
                        collectDependencies(p, cnf, out)
                    }
                }
            }
            
            gradle.buildFinished {
                exportDependencies(rootProject.projectDir, out)
            }`,
            {},
            function (err) {
                if (err) throw err
            }
        )
    })
}
