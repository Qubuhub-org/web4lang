grammar Web4Lang;

/* =========================================================================
 * PARSER RULES (Ordered by Operator Precedence)
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
    : LET IDENTIFIER (COLON typeSpec)? ASSIGN expression SEMI
    ;

assignment
    : IDENTIFIER ASSIGN expression SEMI
    ;

expressionStmt
    : expression SEMI
    ;

expression
    : primary
    | expression op=(MUL | DIV | MOD) expression
    | expression op=(ADD | SUB) expression
    | expression op=(EQ | NEQ | LT | LTE | GT | GTE) expression
    | expression op=(AND | OR) expression
    ;

primary
    : IDENTIFIER
    | NUMBER
    | STRING
    | BOOLEAN
    | LPAREN expression RPAREN
    ;

typeSpec
    : 'i32' | 'f64' | 'bool' | 'string'
    ;

/* =========================================================================
 * LEXER RULES
 * ========================================================================= */

LET        : 'let' ;
BOOLEAN    : 'true' | 'false' ;

ADD        : '+' ;
SUB        : '-' ;
MUL        : '*' ;
DIV        : '/' ;
MOD        : '%' ;

EQ         : '==' ;
NEQ        : '!=' ;
LT         : '<' ;
LTE        : '<=' ;
GT         : '>' ;
GTE        : '>=' ;

AND        : '&&' ;
OR         : '||' ;

ASSIGN     : '=' ;
COLON      : ':' ;
SEMI       : ';' ;
LPAREN     : '(' ;
RPAREN     : ')' ;

IDENTIFIER : [a-zA-Z_] [a-zA-Z0-9_]* ;
NUMBER     : [0-9]+ ('.' [0-9]+)? ;
STRING     : '"' (~["\\\r\n] | '\\' .)* '"' ;

WS            : [ \t\r\n]+ -> skip ;
COMMENT       : '//' ~[\r\n]* -> skip ;
BLOCK_COMMENT : '/*' .*? '*/' -> skip ;
