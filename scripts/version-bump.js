#!/usr/bin/env node

/**
 * Local Version Bump Script
 * 
 * Usage:
 *   node scripts/version-bump.js patch
 *   node scripts/version-bump.js minor  
 *   node scripts/version-bump.js major
 *   node scripts/version-bump.js --branch=dev
 *   node scripts/version-bump.js --auto
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
  } catch (error) {
    console.error('Error getting current branch:', error.message)
    return 'unknown'
  }
}

function getCurrentVersion() {
  const packagePath = join(projectRoot, 'package.json')
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  return packageJson.version
}

function getBumpTypeForBranch(branch) {
  switch (branch) {
    case 'dev':
      return 'patch'
    case 'staging':
      return 'minor'
    case 'main':
    case 'prod':
      return 'major'
    default:
      return 'patch'
  }
}

function bumpVersion(bumpType) {
  console.log(`🔄 Bumping version: ${bumpType}`)
  
  try {
    // Use pnpm to bump version
    execSync(`pnpm version ${bumpType} --no-git-tag-version`, { 
      cwd: projectRoot,
      stdio: 'inherit'
    })
    
    return getCurrentVersion()
  } catch (error) {
    console.error('❌ Error bumping version:', error.message)
    process.exit(1)
  }
}

function updateVersionFiles(newVersion) {
  console.log(`📝 Updating version files to ${newVersion}`)
  
  // Update src/config/version.ts
  const versionTsPath = join(projectRoot, 'src/config/version.ts')
  try {
    let versionTs = readFileSync(versionTsPath, 'utf8')
    versionTs = versionTs.replace(
      /export const VERSION = .*/,
      `export const VERSION = '${newVersion}'`
    )
    writeFileSync(versionTsPath, versionTs)
    console.log('✅ Updated src/config/version.ts')
  } catch (error) {
    console.warn('⚠️ Could not update src/config/version.ts:', error.message)
  }
  
  // Update src/config/environments.ts if it exists
  const environmentsPath = join(projectRoot, 'src/config/environments.ts')
  try {
    let environmentsTs = readFileSync(environmentsPath, 'utf8')
    environmentsTs = environmentsTs.replace(
      /version: .*/,
      `version: '${newVersion}',`
    )
    writeFileSync(environmentsPath, environmentsTs)
    console.log('✅ Updated src/config/environments.ts')
  } catch (error) {
    console.warn('⚠️ Could not update src/config/environments.ts:', error.message)
  }
}

function createCommitAndTag(newVersion, previousVersion, bumpType, branch) {
  console.log(`📦 Creating commit and tag for version ${newVersion}`)
  
  try {
    // Configure git if needed
    execSync('git config user.email || git config user.email "dev@cnidaria.com"', { 
      cwd: projectRoot,
      stdio: 'pipe'
    })
    execSync('git config user.name || git config user.name "Cnidaria Developer"', { 
      cwd: projectRoot,
      stdio: 'pipe'
    })
    
    // Add all changed files
    execSync('git add .', { cwd: projectRoot })
    
    // Create commit
    const commitMessage = `chore(${branch}): bump version to ${newVersion} [${bumpType}]

- Version bump from ${previousVersion} to ${newVersion}
- Branch: ${branch}
- Bump type: ${bumpType}
- Created by: scripts/version-bump.js`
    
    execSync(`git commit -m "${commitMessage}"`, { 
      cwd: projectRoot,
      stdio: 'inherit'
    })
    
    // Create tag
    execSync(`git tag -a "v${newVersion}" -m "Version ${newVersion} - ${bumpType} bump from ${branch}"`, { 
      cwd: projectRoot,
      stdio: 'inherit'
    })
    
    console.log(`✅ Created commit and tag v${newVersion}`)
    
    // Ask if user wants to push
    console.log('\n🚀 To push changes and tag, run:')
    console.log(`   git push origin ${branch}`)
    console.log(`   git push origin v${newVersion}`)
    
  } catch (error) {
    console.error('❌ Error creating commit and tag:', error.message)
    process.exit(1)
  }
}

function main() {
  const args = process.argv.slice(2)
  const currentBranch = getCurrentBranch()
  const currentVersion = getCurrentVersion()
  
  console.log('🎯 Cnidaria Version Bump Tool')
  console.log(`📍 Current branch: ${currentBranch}`)
  console.log(`📋 Current version: ${currentVersion}`)
  
  let bumpType
  let autoBump = false
  
  // Parse arguments
  for (const arg of args) {
    if (arg === '--auto') {
      autoBump = true
    } else if (arg.startsWith('--branch=')) {
      // Override branch detection (for testing)
      const overrideBranch = arg.split('=')[1]
      console.log(`🔄 Branch override: ${overrideBranch}`)
      bumpType = getBumpTypeForBranch(overrideBranch)
    } else if (['patch', 'minor', 'major'].includes(arg)) {
      bumpType = arg
    }
  }
  
  // Determine bump type
  if (!bumpType) {
    if (autoBump) {
      bumpType = getBumpTypeForBranch(currentBranch)
      console.log(`🤖 Auto-detected bump type: ${bumpType} (based on branch: ${currentBranch})`)
    } else {
      console.log('\n📋 Branch Versioning Strategy:')
      console.log('   dev → patch (0.0.+1)')
      console.log('   staging → minor (0.+1.0)')
      console.log('   main/prod → major (+1.0.0)')
      console.log(`\n💡 Recommended for ${currentBranch}: ${getBumpTypeForBranch(currentBranch)}`)
      console.log('\nUsage:')
      console.log('   node scripts/version-bump.js patch|minor|major')
      console.log('   node scripts/version-bump.js --auto')
      process.exit(1)
    }
  }
  
  // Validate bump type for branch
  const recommendedBump = getBumpTypeForBranch(currentBranch)
  if (bumpType !== recommendedBump && !autoBump) {
    console.log(`⚠️ WARNING: ${currentBranch} branch typically uses ${recommendedBump} bumps, but ${bumpType} was requested`)
    console.log('Proceeding anyway...')
  }
  
  // Perform version bump
  console.log(`\n🚀 Starting ${bumpType} version bump on ${currentBranch}`)
  
  const newVersion = bumpVersion(bumpType)
  updateVersionFiles(newVersion)
  createCommitAndTag(newVersion, currentVersion, bumpType, currentBranch)
  
  console.log(`\n✅ Version bump complete!`)
  console.log(`   ${currentVersion} → ${newVersion} (${bumpType})`)
}

main()
