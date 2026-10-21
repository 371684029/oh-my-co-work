import assert from 'node:assert/strict'
import test from 'node:test'
import {
  onboardingFirstRunExplore,
  onboardingFirstRunTitle,
} from '../src/composables/appOnboardingCopy.js'

test('appOnboardingCopy first-run strings', () => {
  assert.match(onboardingFirstRunTitle(), /oh-my-co-work/i)
  assert.match(onboardingFirstRunExplore(), /开始探索|Start exploring/)
})
