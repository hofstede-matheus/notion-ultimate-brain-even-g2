@glasses
Feature: Starting the app

  Scenario: The glasses show that the app has started
    When the app starts on the glasses
    Then the glasses show:
      """
      ULTIMATE BRAIN

      Started.
      Loading your menu…
      """

  Scenario: Leaving the startup screen closes the app
    Given the startup screen is showing
    When I double-tap
    Then the app closes and the glasses return to the Even Hub launcher

  Scenario: The glasses explain first-run setup
    Given the app has not been set up
    When it starts on the glasses
    Then the glasses show:
      """
      ULTIMATE BRAIN

      Setup needed.
      Continue on your phone to add
      your Notion token and databases.
      """
    And the message remains while I enter settings on my phone

  Scenario: The glasses explain a connection failure after startup
    Given the app has started on the glasses
    When connecting cannot continue
    Then the glasses show:
      """
      ULTIMATE BRAIN

      Can't connect.
      Check the Even Hub app on your
      phone, then retry.
      """
