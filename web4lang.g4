grammar Web4Lang;

/* =========================================================================
 * PARSER RULES
 * ========================================================================= */

program
    : statement* EOF
    ;

statement
    : varDecl
    | assignment
    | expressionStmt
    ;

varDecl
    : 'let' IDENTIFIER '=' expression ';'
    ;

assignment
    : IDENTIFIER '=' expression ';'
    ;

expressionStmt
    : expression ';'
    ;

expression
    : primary
    ( op=(MUL | DIV | ADD | SUB) primary )*
    ;

primary
    : IDENTIFIER
    | NUMBER
    | STRING
    | '(' expression ')'
    ;

/* =========================================================================
 * LEXER RULES
 * ========================================================================= */

LET        : 'let' ;
ADD        : '+' ;
SUB        : '-' ;
MUL        : '*' ;
DIV        : '/' ;
ASSIGN     : '=' ;
SEMI       : ';' ;
LPAREN     : '(' ;
RPAREN     : ')' ;

IDENTIFIER : [a-zA-Z_] [a-zA-Z0-9_]* ;
NUMBER     : [0-9]+ ('.' [0-9]+)? ;
STRING     : '"' (~["\\\r\n] | '\\' .)* '"' ;

WS         : [ \t\r\n]+ -> skip ;
COMMENT    : '//' ~[\r\n]* -> skip ;
BLOCK_COMMENT : '/*' .*? '*/' -> skip ;
