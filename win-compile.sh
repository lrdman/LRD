#!/bin/sh
CP="lib/*;classes"
SP=src/java/

/bin/rm -f lrd.jar
/bin/rm -f lrdservice.jar
/bin/rm -rf classes
/bin/mkdir -p classes/

javac -encoding utf8 -sourcepath "${SP}" -classpath "${CP}" -d classes/ src/java/lrd/*.java src/java/lrd/*/*.java || exit 1

echo "lrd class files compiled successfully"
