require("dotenv").config();

module.exports = {
  apps : [{
    script: 'app.js',
    watch: '.'
  }],

  deploy : {
    production : {
      key  : process.env.KEY,
      user : process.env.USER,
      host : process.env.HOST,
      ref  : 'origin/master',
      repo : process.env.REPO,
      path : '/var/apps/VocabularyDashboard',
      'pre-deploy-local': '',
      'post-deploy' : 'npm install && npx pm2 reload ecosystem.config.js',
      'pre-setup': ''
    }
  }
};
