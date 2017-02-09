// generated on 2016-07-28 using generator-webapp 2.1.0
const gulp = require('gulp')
const gulpLoadPlugins = require('gulp-load-plugins')
const browserSync = require('browser-sync')
const del = require('del')
const wiredep = require('wiredep').stream
const modRewrite = require('connect-modrewrite')
const httpProxyMiddleware = require('http-proxy-middleware')
const streamqueue = require('streamqueue')
const merge = require('merge-stream')
const path = require('path')
const mainBowerFiles = require('main-bower-files')

const $ = gulpLoadPlugins();
const reload = browserSync.reload;

const config = {
  appName: 'alianza.pqr',
  tmpPath: '.tmp',
  distPath: 'dist',
}

gulp.task('styles', () => {
  return gulp.src('app/styles/*.scss')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)+/
    }))
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    }).on('error', $.sass.logError))
    .pipe($.autoprefixer({browsers: ['> 1%', 'last 2 versions', 'Firefox ESR']}))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest(config.tmpPath+'/styles'))
    .pipe(reload({stream: true}))
});

gulp.task('scripts', () => {
  return gulp.src('app/scripts/**/*.js')
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe($.babel())
    .pipe($.ngAnnotate())
    .pipe($.sourcemaps.write('.'))
    .pipe(gulp.dest(config.tmpPath+'/scripts'))
    .pipe(reload({stream: true}));
});

function lint(files, options) {
  return gulp.src(files)
    .pipe(reload({stream: true, once: true}))
    .pipe($.eslint(options))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
}

gulp.task('lint', () => {
  return lint('app/scripts/**/*.js', {
    fix: true
  })
    .pipe(gulp.dest('app/scripts'));
});

gulp.task('lint:test', () => {
  return lint('test/spec/**/*.js', {
    fix: true,
    env: {
      mocha: true
    }
  })
    .pipe(gulp.dest('test/spec/**/*.js'));
});

gulp.task('templates', () => {
  return gulp.src(['app/**/*.html', '!app/index.html'])
    .pipe($.angularTemplatecache({ module: config.appName }))
    .pipe(gulp.dest(config.tmpPath))
})

gulp.task('inject', () => {
  var sources = streamqueue({ objectMode: true },
    gulp.src('app/**/*.js').pipe($.babel()).pipe($.angularFilesort())
  )
  return gulp.src('app/*.html')
    .pipe(wiredep({
      exclude: ['bootstrap-sass'],
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe($.inject(sources, { ignorePath: 'app' }))
    .pipe(gulp.dest(config.tmpPath))
    .pipe(reload({stream: true}))
})

gulp.task('bundle', ['templates'], () => {
  var sources = streamqueue({ objectMode: true },
    gulp.src(['app/**/*.js', '!app/scripts/app.js'])
      .pipe($.babel())
      .pipe($.angularEmbedTemplates({basePath: 'app'}))
      .pipe($.ngAnnotate())
  )
  var templates = gulp.src(config.tmpPath+'/templates.js')
  var appSources = merge(sources, templates).pipe($.angularFilesort())
  var dependencies = gulp.src('./bower.json')
    .pipe($.mainBowerFiles('**/*.js', {group: 'distro'}))
  return merge(dependencies, appSources)
    .pipe($.concat('pqr.js'))
    .pipe(gulp.dest(config.distPath))
    .pipe($.uglify())
    .pipe($.rename('pqr.min.js'))
    .pipe(gulp.dest(config.distPath))
})

gulp.task('html', ['styles', 'scripts', 'inject', 'templates'], () => {
  return gulp.src(config.tmpPath+'/*.html')
    .pipe($.inline({
      css: () => {
        return $.cssnano({
          safe: true, autoprefixer: false,
          discardComments: {
            removeAll: true
          }
        })
      },
      disabledTypes: ['svg', 'img', 'js']
    }))
    .pipe($.useref({searchPath: [config.tmpPath, 'app', '.']}))
    .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.html', $.htmlmin({collapseWhitespace: true, removeComments: true})))
    .pipe(gulp.dest(config.distPath));
})

gulp.task('locales', () => {
  return gulp.src('app/locales/**/*.json')
  .pipe(gulp.dest(path.join(config.distPath, 'locales')))
})


gulp.task('images', () => {
  return gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true,
      // don't remove IDs from SVGs, they are often used
      // as hooks for embedding and styling
      svgoPlugins: [{cleanupIDs: false}]
    })))
    .pipe(gulp.dest(config.distPath+'/images'));
});

gulp.task('fonts', () => {
  return gulp.src(mainBowerFiles('**/*.{eot,svg,ttf,woff,woff2}', function (err) {})
    .concat('app/fonts/**/*'))
    .pipe(gulp.dest(config.tmpPath+'/fonts'))
    .pipe(gulp.dest(config.distPath+'/fonts'));
});

gulp.task('extras', () => {
  return gulp.src([
    'app/*.*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest(config.distPath));
});

gulp.task('clean', del.bind(null, [config.tmpPath, config.distPath]));

gulp.task('serve', ['styles', 'scripts', 'fonts', 'inject', 'templates'], () => {
  browserSync({
    notify: false,
    port: 9006,
    server: {
      baseDir: [config.tmpPath, 'app'],
      middleware: [
        modRewrite(['!\\.\\w+$ /index.html [L]']),
        httpProxyMiddleware('/api_services', {
          target: 'http://localhost:9991',
          pathRewrite: {'^/api_services' : '/'},
          changeOrigin: true,
          headers: { 'Remote-Address': '127.0.0.1' }
        })
      ],
      routes: {
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch([
    'app/locales/**/*',
    'app/images/**/*',
    config.tmpPath+'/fonts/**/*'
  ]).on('change', reload);

  gulp.watch('app/*.html', ['inject']);
  gulp.watch('app/views/**/*.html', ['templates']).on('change', reload);
  gulp.watch('app/styles/**/*.scss', ['styles']);
  gulp.watch('app/scripts/**/*.js', ['scripts', 'inject']);
  gulp.watch('app/fonts/**/*', ['fonts']);
  gulp.watch('bower.json', ['styles', 'inject', 'fonts']);
});

gulp.task('serve:dist', () => {
  browserSync({
    notify: false,
    port: 9006,
    server: {
      baseDir: [config.distPath],
      middleware: [
        modRewrite(['!\\.\\w+$ /index.html [L]'])
      ],
    }
  });
});

gulp.task('serve:test', ['scripts'], () => {
  browserSync({
    notify: false,
    port: 9000,
    ui: false,
    server: {
      baseDir: 'test',
      routes: {
        '/scripts': config.tmpPath+'/scripts',
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch('app/scripts/**/*.js', ['scripts']);
  gulp.watch('test/spec/**/*.js').on('change', reload);
  gulp.watch('test/spec/**/*.js', ['lint:test']);
});

gulp.task('build', ['lint', 'html', 'images', 'fonts', 'locales', 'extras'], () => {
  return gulp.src(config.distPath+'/**/*').pipe($.size({title: 'build', gzip: true}));
});

gulp.task('default', ['clean'], () => {
  gulp.start('bundle');
});
