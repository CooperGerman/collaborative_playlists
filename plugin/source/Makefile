.PHONY: build package clean restore

restore:
	dotnet restore

build: restore
	dotnet build -c Release

package: build
	mkdir -p ../artifacts
	cp meta.json bin/Release/net10.0/meta.json
	python3 ../../scripts/package_plugin.py
	@echo "Packaged: ../CollaborativePlaylists.zip"

clean:
	rm -rf bin obj ../artifacts