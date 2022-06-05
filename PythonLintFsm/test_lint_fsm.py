from lintFsm import state_machine
import unittest

CONST_STATE_TEST_1 = 'state_test_1'
CONST_STATE_TEST_2 = 'state_test_2'
CONST_STATE_TEST_3 = 'state_test_3'
CONST_STATE_TEST_END = 'state_test_end'
CONST_STATE_TEST_ERROR = 'state_test_error'

def state_test_1(cargo):
    return CONST_STATE_TEST_3, cargo

def state_test_2(cargo):
    return CONST_STATE_TEST_ERROR, cargo

def state_test_3(cargo):
    return CONST_STATE_TEST_END, cargo

class Test_fsm(unittest.TestCase):
    def setUp(self):
        self.fsm = state_machine()
        self.fsm.add_state(CONST_STATE_TEST_1, state_test_1)
        self.fsm.add_state(CONST_STATE_TEST_2, state_test_2)
        self.fsm.add_state(CONST_STATE_TEST_3, state_test_3)
        self.fsm.add_state(CONST_STATE_TEST_ERROR, None, end_state=True)
        self.fsm.add_state(CONST_STATE_TEST_END, None, end_state=True)

    def test_start1_end(self):
        self.fsm.set_start(CONST_STATE_TEST_1)
        self.assertEqual(self.fsm.run('test'), (CONST_STATE_TEST_END, 'test'))

    def test_start2_error(self):
        self.fsm.set_start(CONST_STATE_TEST_2)
        self.assertEqual(self.fsm.run('test'), (CONST_STATE_TEST_ERROR, 'test'))
        
if __name__ == '__main__':
    unittest.main()
