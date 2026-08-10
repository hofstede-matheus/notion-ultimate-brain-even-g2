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
