# HuamanSalirrosas.github.io

Sitio personal publicado con GitHub Pages. La página es estática; Python se usa
únicamente como herramienta local para generar los videos del retrato animado.

## Entorno de desarrollo de Python

Usa un entorno virtual para que NumPy y OpenCV no se instalen globalmente ni
entren en conflicto con otros proyectos. El entorno se guarda en `.venv/` y Git
lo ignora.

### macOS y Linux

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements-animation.txt
```

### Windows PowerShell

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements-animation.txt
```

Mientras el entorno esté activo, la terminal mostrará normalmente `(.venv)`.
Para salir del entorno ejecuta:

```sh
deactivate
```

No copies ni confirmes `.venv/`: cada persona debe recrearlo a partir de
`requirements-animation.txt`.

## Generar el retrato animado

### Enfoque recomendado

La web **ya carga la animación como un video**. Python no se ejecuta en el
navegador ni en GitHub Pages: solo es una herramienta opcional para producir
`marina-loop.webm` y `marina-loop.mp4` antes de publicar.

Hay dos formas válidas de crear esos archivos:

1. Ejecutar `tools/generate_portrait.py` si quieres que el resultado sea
   reproducible y ajustar el movimiento mediante código.
2. Crear la animación en After Effects, Blender, CapCut u otro editor y exportar
   directamente un WebM y un MP4 con esos mismos nombres.

Para este sitio pequeño, un video pre-renderizado es más sencillo y eficiente
que ejecutar una animación compleja con JavaScript en cada navegador. Conserva
el generador de Python solo si necesitas volver a crear o modificar el efecto.

### Generarla con Python

Además de las dependencias de Python, instala
[FFmpeg](https://ffmpeg.org/download.html) en el sistema y comprueba que el
comando `ffmpeg` esté disponible. Con el entorno virtual activo, ejecuta:

```sh
python tools/generate_portrait.py --prototype
```

El comando crea los videos dentro de `assets/portrait/`. Para probar el sitio
localmente sin desactivar el entorno:

```sh
python -m http.server 8000
```

Después abre <http://localhost:8000>. Detén el servidor con `Ctrl+C`.

Cuando el resultado esté aprobado, añade a Git los dos archivos de producción:

```sh
git add assets/portrait/marina-loop.webm assets/portrait/marina-loop.mp4
git commit -m "Add animated portrait videos"
git push
```

Esto es necesario porque GitHub Pages no ejecuta el generador: únicamente puede
servir videos que ya estén en el repositorio publicado. El archivo opcional
`marina-preview.mp4` permanece ignorado porque solo sirve para revisión local.

Para reproducir el entorno en el futuro, elimina `.venv/`, vuelve a crearlo y
repite la instalación desde el archivo de requisitos. No uses `pip install`
global para las dependencias de esta animación.

Consulta [ANIMATION.md](ANIMATION.md) para conocer la implementación y los
tiempos de la animación.
