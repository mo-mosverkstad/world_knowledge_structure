from lintKify import *
import unittest

class Test_kify_statement_normal(unittest.TestCase):
    def _check_correct_result(self, statement, expected_result):
        next_state, (_, _, _, _, _, result) = fsm.run((None, None, statement, [], None, {}))
        self.assertEqual(next_state, STATE_END)
        self.assertEqual(result, expected_result)

    def test_normal_rect_with_color(self):
        self._check_correct_result('Rect ( 10 , 20 ,30  , 50   , green)', {'widget_name': 'Rect', 'numbers': [10, 20, 30, 50], 'color': 'green'})

    def test_normal_rect_without_color(self):
        self._check_correct_result('Rect ( 10 , 20 ,30  , 50  )', {'widget_name': 'Rect', 'numbers': [10, 20, 30, 50]})

    def test_normal_circle_with_color(self):
        self._check_correct_result('Circle ( 10 , 20 ,30  , red  )', {'widget_name': 'Circle', 'numbers': [10, 20, 30], 'color': 'red'})

    def test_normal_circle_without_color(self):
        self._check_correct_result('Circle ( 10 , 20 ,30   )', {'widget_name': 'Circle', 'numbers': [10, 20, 30]})

    def test_normal_line_with_color(self):
        self._check_correct_result('Line ( 10 , 20 ,30,40, 50, 60  , red  )', {'widget_name': 'Line', 'numbers': [10, 20, 30, 40, 50, 60], 'color': 'red'})

    def test_normal_line_without_color(self):
        self._check_correct_result('Line ( 10 , 20 ,30 ,40, 50, 60  )', {'widget_name': 'Line', 'numbers': [10, 20, 30, 40, 50, 60]})


class Test_kify_statement_abnormal(unittest.TestCase):
    def _check_wrong_result(self, statement, expected_message):
        next_state, (_, _, _, _, message, _) = fsm.run((None, None, statement, [], None, {}))
        self.assertEqual(next_state, STATE_ERROR)
        self.assertEqual(message, expected_message)

    def test_abnormal_rect_missing_widget_name(self):
        self._check_wrong_result('( 10 , 20 ,30  , 50   , green)', ERROR_MESSAGE_NO_WORD)

    def test_abnormal_rect_wrong_widget_name(self):
        self._check_wrong_result('rectangle ( 10 , 20 ,30  , 50   , green)', ERROR_MESSAGE_NOT_WIDGET_NAME)

    def test_abnormal_rect_missing_parameter_begin(self):
        self._check_wrong_result('rect 10 , 20 ,30  , 50   , green)', ERROR_MESSAGE_MISSING_PARAMETER_BEGIN)

    def test_abnormal_rect_wrong_parameter_begin(self):
        self._check_wrong_result('rect [10 , 20 ,30  , 50   , green)', ERROR_MESSAGE_MISSING_PARAMETER_BEGIN)

    def test_abnormal_rect_missing_number_1(self):
        self._check_wrong_result('rect (  , 20 ,30  , 50   , green)', ERROR_MESSAGE_NO_NUMBER)

    def test_abnormal_rect_missing_number_2(self):
        self._check_wrong_result('rect ( 10 ,  ,30  , 50   , green)', ERROR_MESSAGE_WRONG_SYMBOL)

    def test_abnormal_rect_missing_number_3(self):
        self._check_wrong_result('rect ( 10 , 20 ,  , 50   , green)', ERROR_MESSAGE_WRONG_SYMBOL)

    def test_abnormal_rect_missing_number_4_with_color(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  ,    , green)', ERROR_MESSAGE_WRONG_SYMBOL)

    def test_abnormal_rect_missing_number_4_without_color(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  ,   )', ERROR_MESSAGE_WRONG_SYMBOL)

    def test_abnormal_rect_wrong_number_1(self):
        self._check_wrong_result('rect ( aa , 20 ,30  , 50   , green)', ERROR_MESSAGE_NO_NUMBER)

    def test_abnormal_rect_wrong_number_2(self):
        self._check_wrong_result('rect ( 10 , bb ,30  , 50   , green)', ERROR_MESSAGE_NOT_COLOR_NAME)

    def test_abnormal_rect_wrong_number_3(self):
        self._check_wrong_result('rect ( 10 , 20 , cc , 50   , green)', ERROR_MESSAGE_NOT_COLOR_NAME)

    def test_abnormal_rect_wrong_number_4(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , dd   , green)', ERROR_MESSAGE_NOT_COLOR_NAME)

    def test_abnormal_rect_wrong_comma_1(self):
        self._check_wrong_result('rect ( 10 ; 20 ,30  , 50   , green)', ERROR_MESSAGE_MISSING_COMMA)

    def test_abnormal_rect_wrong_comma_2(self):
        self._check_wrong_result('rect ( 10 , 20 :30  , 50   , green)', ERROR_MESSAGE_MISSING_COMMA)

    def test_abnormal_rect_wrong_comma_3(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  x 50   , green)', ERROR_MESSAGE_MISSING_COMMA)

    def test_abnormal_rect_wrong_comma_4(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , 50   : green)', ERROR_MESSAGE_MISSING_COMMA)

    def test_abnormal_rect_missing_end_with_color(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , 50  , green', ERROR_MESSAGE_MISSING_PARAMETER_END)

    def test_abnormal_rect_missing_end_without_color_1(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , 50  ', ERROR_MESSAGE_MISSING_COMMA)

    def test_abnormal_rect_missing_end_without_color_2(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , 50,  ', ERROR_MESSAGE_WRONG_SYMBOL)

    def test_abnormal_rect_wrong_end_with_color(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , 50  , green]', ERROR_MESSAGE_MISSING_PARAMETER_END)

    def test_abnormal_rect_wrong_end_without_color(self):
        self._check_wrong_result('rect ( 10 , 20 ,30  , 50  }', ERROR_MESSAGE_MISSING_COMMA)


if __name__ == '__main__':
    unittest.main()
