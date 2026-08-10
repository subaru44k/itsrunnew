import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from 'playwright'
import { driveHostedUiSignIn } from './t16-auth-harness.mjs'

const fixtureHtml = `<!doctype html><style>
  form[name="cognitoSignInForm"] { display: none; }
  @media (min-width: 601px) { form[name="cognitoSignInForm"].desktop { display: block; } }
  @media (max-width: 600px) { form[name="cognitoSignInForm"].mobile { display: block; } }
</style>
<form name="cognitoSignInForm" class="desktop"><input name="username"><input name="password" type="password"><input name="signInSubmitButton" type="submit" value="Sign in"></form>
<form name="cognitoSignInForm" class="mobile"><input name="username"><input name="password" type="password"><input name="signInSubmitButton" type="submit" value="Sign in"></form>
<script>
  window.__submits = { desktop: 0, mobile: 0 };
  for (const form of document.forms) form.addEventListener('submit', event => { event.preventDefault(); window.__submits[form.className] += 1; });
</script>`

test('real Chromium selects and submits only the visible responsive Cognito form', async t => {
  const browser = await chromium.launch({ headless: true })
  t.after(() => browser.close())
  for (const [viewport, expected] of [[{ width: 1024, height: 700 }, 'desktop'], [{ width: 390, height: 844 }, 'mobile']]) {
    const page = await browser.newPage({ viewport })
    await page.setContent(fixtureHtml)
    const result = await driveHostedUiSignIn(page, {
      username: 'fixture-alias',
      password: 'fixture-password',
      timeoutMs: 1000,
      waitForNavigationSignal: () => page.waitForFunction(() => Object.values(window.__submits).some(value => value === 1)),
    })
    assert.deepEqual(result, { checkpoint: 'form-submitted' })
    const state = await page.evaluate(() => ({
      submits: window.__submits,
      forms: [...document.forms].map(form => ({ className: form.className, username: form.username.value, password: form.password.value })),
    }))
    assert.equal(state.submits[expected], 1)
    assert.equal(state.submits[expected === 'desktop' ? 'mobile' : 'desktop'], 0)
    assert.equal(state.forms.find(form => form.className === expected).username, 'fixture-alias')
    assert.equal(state.forms.find(form => form.className === expected).password, 'fixture-password')
    assert.equal(state.forms.find(form => form.className !== expected).username, '')
    await page.close()
  }
})
