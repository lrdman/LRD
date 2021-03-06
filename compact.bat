@REM Compact the Lrd LRS database
@echo *********************************************************************
@echo * This batch file will compact and reorganize the Lrd LRS database. *
@echo * This process can take a long time.  Do not interrupt the batch    *
@echo * file or shutdown the computer until it finishes.                  *
@echo *********************************************************************

java -Xmx768m -cp "classes;lib/*;conf" -Dlrd.runtime.mode=desktop lrd.tools.CompactDatabase
