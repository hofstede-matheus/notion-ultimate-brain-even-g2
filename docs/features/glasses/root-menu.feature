@glasses @navigation
Feature: The root menu

  The main screen after startup, and the only menu screen a double-tap exits from. Everything
  else in the app is reached from these four rows.

  Scenario: The app opens on the root menu
    When the glasses connect and the app starts
    Then the glasses show the header "Ultimate Brain"
    And the rows are:
      | Tasks    |
      | Notes    |
      | Projects |
      | Tags     |

  Scenario Outline: Each row opens its section
    When I tap "<row>"
    Then the glasses show the header "<header>"

    Examples:
      | row      | header   |
      | Tasks    | TASKS    |
      | Notes    | NOTES    |
      | Projects | PROJECTS |
      | Tags     | TAGS     |

  Scenario Outline: Every section returns to the root menu
    Given I am on the "<header>" menu
    When I double-tap
    Then the glasses show the header "Ultimate Brain"

    Examples:
      | header   |
      | TASKS    |
      | NOTES    |
      | PROJECTS |
      | TAGS     |

  Scenario: Double-tapping at the root closes the app
    Given I am on the root menu
    When I double-tap
    Then the app closes and the glasses return to the Even Hub launcher
    # The root is the only screen with nothing above it — a double-tap there means "I'm done",
    # not "go back".
