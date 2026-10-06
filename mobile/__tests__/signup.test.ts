import { passwordProblem } from '../src/utils/password';

test('password rules match the web app', () => {
  expect(passwordProblem('short')).toMatch(/8 characters/);
  expect(passwordProblem('alllowercase1!')).toMatch(/upper and lower/);
  expect(passwordProblem('NoNumbers!!')).toMatch(/number/);
  expect(passwordProblem('NoSymbol123')).toMatch(/symbol/);
  expect(passwordProblem('Passw0rd!23')).toBeNull();
});
