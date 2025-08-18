#!/usr/bin/env node

/**
 * Simple test runner to validate that all converter tests work properly
 * This can be run with: npm test or node test/run-tests.ts
 */

import { execSync } from 'child_process';

console.log('🧪 Running Qualifire TypeScript SDK Tests...\n');

const testFiles = [
  'test/claude.converter.spec.ts',
  'test/openai.converter.spec.ts', 
  'test/gemini.converter.spec.ts',
  'test/vercelai.converter.spec.ts'
];

let passedTests = 0;
let failedTests = 0;

for (const testFile of testFiles) {
  try {
    console.log(`▶️  Running ${testFile}...`);
    
    // Run jest for this specific test file
    execSync(`npx jest ${testFile} --verbose`, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    console.log(`✅ ${testFile} passed\n`);
    passedTests++;
  } catch (error) {
    console.log(`❌ ${testFile} failed\n`);
    failedTests++;
  }
}

console.log('\n📊 Test Summary:');
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);

if (failedTests > 0) {
  console.log('\n❌ Some tests failed. Please check the output above.');
  throw new Error(`${failedTests} test suite(s) failed`);
} else {
  console.log('\n🎉 All tests passed!');
}
