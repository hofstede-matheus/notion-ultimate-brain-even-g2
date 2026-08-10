@phone @connection
Feature: Connecting the app to the glasses

  The phone side is a status screen and a settings form, nothing more. Its job is to get from "app
  opened" to "the glasses are showing the menu", and to say plainly where that got stuck if it did.

  The status line is the whole story — there is no progress bar and no detail beyond it.

  Scenario: The app opens already trying to connect
    When I open the app
    Then the phone shows "Ultimate Brain"
    And the status reads "Connecting..."
    And a "Connect" button is shown

  Scenario: Waiting for the glasses
    When the app starts connecting
    Then the status reads "Waiting for Even Hub bridge..."
    And the "Connect" button is greyed out

  Scenario: Connecting when it has been set up before
    Given the app was set up on a previous run
    When it connects
    Then the settings form is not shown
    And the glasses briefly show that Ultimate Brain started
    And the glasses show their menu
    And the status reads "Connected! Use your glasses."
    And the "Connect" button disappears

  Scenario: Connecting for the first time
    Given the app has never been set up
    When it connects
    Then the status reads "Enter your Notion settings to continue."
    And the settings form opens

  Scenario: The glasses cannot be reached
    Given the glasses cannot be reached
    When the app tries to connect
    Then the status reads "Connection failed. Tap to retry."
    And a "Retry" button is shown

  Scenario: Waiting for Even Hub times out
    Given Even Hub does not provide a bridge
    When the app waits for the glasses
    Then the status reads "Connection failed. Tap to retry."
    And a "Retry" button is shown

  Scenario: The glasses will not show the app
    Given the glasses will not let the app draw on them
    When the app tries to connect
    Then the status reads "Glasses display setup failed — check the glasses are connected, then retry."
    And a "Retry" button is shown

  Scenario: A connection failure after rendering is shown on the glasses
    Given the app has started on the glasses
    When connecting cannot continue
    Then the glasses explain how to retry in Even Hub

  Scenario: Retrying
    Given the status reads "Connection failed. Tap to retry."
    When I tap "Retry"
    Then it tries again from the beginning
    And on success the status reads "Connected! Use your glasses."

  Scenario: Settings can be opened at any time
    Given the app is connected, or connecting, or has failed
    Then a settings button is shown in the top right
    When I tap it
    Then the settings form opens

  Scenario: The settings button is hidden while settings are open
    Given the settings form is open
    Then no settings button is shown

  Scenario: Opening settings again during first-run setup keeps connecting
    Given the app is waiting for me to fill in first-run settings
    When I tap the settings button
    Then the settings form is shown
    When I save it
    Then the app finishes connecting
