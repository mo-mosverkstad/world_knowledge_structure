from lintABMachine import fsm, CONST_STATE_END, CONST_STATE_ERROR, CONST_ERROR_MESSAGE_DOT_MISSING, CONST_ERROR_MESSAGE_INVALID_VALUE
import unittest

class Test_ab_normal(unittest.TestCase):
    def _check_correct_result(self, value):
        next_state, cargo = fsm.run((value, 0, None))
        self.assertEqual(next_state, CONST_STATE_END)

    def test_normal(self):
        self._check_correct_result('ababaabb.')

    def test_normal_a(self):
        self._check_correct_result("aaaaaaaa.")

    def test_normal_b(self):
        self._check_correct_result("bbbbbbbb.")

    def test_normal_miss_ab(self):
        self._check_correct_result(".")

class Test_ab_abnormal(unittest.TestCase):
    def _check_wrong_result(self, value, expected_message):
        next_state, (_, _, message) = fsm.run((value, 0, None))
        self.assertEqual(next_state, CONST_STATE_ERROR)
        self.assertEqual(message, expected_message)

    def test_abnormal_miss_dot(self):
        self._check_wrong_result('ababaabb', CONST_ERROR_MESSAGE_DOT_MISSING)

    def test_abnormal_miss_a_dot(self):
        self._check_wrong_result('bbbbbbbb', CONST_ERROR_MESSAGE_DOT_MISSING)

    def test_abnormal_miss_b_dot(self):
        self._check_wrong_result('aaaaaaaaaa', CONST_ERROR_MESSAGE_DOT_MISSING)

    def test_abnormal_empty_line(self):
        self._check_wrong_result('', CONST_ERROR_MESSAGE_DOT_MISSING)

    def test_abnormal_invalid_value(self):
        self._check_wrong_result('aaabqaaa.', CONST_ERROR_MESSAGE_INVALID_VALUE + 'q')

    def test_abnormal_invalid_value_miss_dot(self):
        self._check_wrong_result('aabbpbbaa', CONST_ERROR_MESSAGE_INVALID_VALUE + "p")


if __name__ == '__main__':
    unittest.main()
