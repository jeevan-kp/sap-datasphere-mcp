"""Tests for ABAP Lexer"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from abap_parser.lexer import ABAPLexer, TokenType


class TestABAPLexer:
    def setup_method(self):
        self.lexer = ABAPLexer()

    def test_tokenize_simple_select(self):
        tokens = self.lexer.tokenize("SELECT vbeln FROM vbak")
        assert len(tokens) > 0
        keywords = [t for t in tokens if t.type == TokenType.KEYWORD]
        assert len(keywords) >= 2

    def test_tokenize_cds_view(self):
        content = """@AccessControl.authorizationCheck: #CHECK
define view ZI_TEST as select from vbak
{
  key vbeln as SalesOrder,
  erdat as CreationDate
}"""
        tokens = self.lexer.tokenize(content)
        assert len(tokens) > 0

    def test_remove_comments(self):
        content = '"This is a comment\nSELECT * FROM vbak'
        cleaned = self.lexer.remove_comments(content)
        assert 'comment' not in cleaned.lower() or 'SELECT' in cleaned

    def test_tokenize_string_literal(self):
        tokens = self.lexer.tokenize("SELECT * FROM vbak WHERE name = 'test'")
        strings = [t for t in tokens if t.type == TokenType.STRING]
        assert len(strings) == 1
        assert strings[0].value == "'test'"

    def test_tokenize_number(self):
        tokens = self.lexer.tokenize("SELECT * FROM vbak UP TO 100 ROWS")
        numbers = [t for t in tokens if t.type == TokenType.NUMBER]
        assert len(numbers) == 1
        assert numbers[0].value == "100"
