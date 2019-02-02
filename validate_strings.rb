require 'zendesk_i18n_dev_tools'

paths = ['./src/translations/en.yml']
ZendeskI18nDevTools::YamlValidator.validate!(paths)
