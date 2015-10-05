#!/bin/sh
java -cp classes lrd.tools.ManifestGenerator
/bin/rm -f lrd.jar
jar cfm lrd.jar resource/lrd.manifest.mf -C classes . || exit 1
/bin/rm -f lrdservice.jar
jar cfm lrdservice.jar resource/lrdservice.manifest.mf -C classes . || exit 1

echo "jar files generated successfully"