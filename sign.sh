#!/bin/sh
java -cp "classes:lib/*:conf" lrd.tools.SignTransactionJSON $@
exit $?
