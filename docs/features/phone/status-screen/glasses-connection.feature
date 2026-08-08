@phone @connection
Feature: Showing whether the glasses are connected

  Two different things can be true: the app has finished setting itself up, and the glasses are
  actually connected to the phone. The dot shows the second whenever it knows it, because that is
  the one I can do something about.

  Scenario: Before the glasses have said anything
    Given the app has just connected
    And the glasses have not reported yet
    Then the dot reflects whether the app finished setting up
    And no warning is shown

  Scenario: The glasses are connected
    When the glasses report that they are connected
    Then the dot shows connected
    And no warning is shown

  Scenario: The glasses disconnect
    When the glasses report that they have disconnected
    Then the dot shows disconnected
    And the phone shows "Glasses disconnected — reconnect in the Even app."

  Scenario: The glasses fail to connect
    When the glasses report that they could not connect
    Then the dot shows disconnected
    And the phone shows "Glasses disconnected — reconnect in the Even app."

  Scenario: A moment of connecting is not a disconnection
    Given the glasses are connected and the dot shows connected
    When they report that they are in the middle of connecting
    Then the dot still shows connected
    And no warning appears
    # Otherwise a warning would appear during an ordinary reconnect and stay there.

  Scenario: Reconnecting clears the warning
    Given the phone shows "Glasses disconnected — reconnect in the Even app."
    When the glasses report that they are connected
    Then the warning disappears
    And the dot shows connected

  Scenario: The warning does not block anything
    Given the warning is showing
    Then the settings button still works
    And the status line reads whatever it read before
