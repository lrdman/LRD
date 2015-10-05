#!/bin/sh
java -cp lib/h2*.jar org.h2.tools.Shell -url jdbc:h2:lrd_db/lrd -user sa -password sa
