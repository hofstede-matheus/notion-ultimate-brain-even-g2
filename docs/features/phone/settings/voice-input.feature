@phone @tasks
Feature: Setting up voice input

  Dictating tasks needs a speech recogniser, and there is no longer one inside the app — it was
  39 MB of a 45 MB package, which made installing over Bluetooth painful.

  So the choice is the person's: download the recogniser once and keep everything on the phone, or
  hand the audio to a cloud service they hold an account with. The two are exclusive, deliberately.
  A fallback between them would leave nobody able to say whether a particular sentence left the
  device.

  It sits below the database dropdowns and is saved with Save, like the token and databases.
  Downloading the model is a separate action so a 41 MB transfer is not tied to submitting Notion
  credentials.

  Background:
    Given the settings form is open

  Rule: Choosing a mode

    Scenario: Voice starts off
      Given I have never set up voice input
      Then "Off" is selected
      And the phone shows "Add Task by voice is disabled. Pick a mode to enable it."

    Scenario: The three choices
      Then I can choose between "Off", "On-device" and "Cloud (Soniox)"

    Scenario: The choice sticks
      When I choose "On-device"
      And I tap "Save"
      And I close and reopen settings
      Then "On-device" is still selected

    Scenario: Backing out discards an unsaved choice
      Given voice input is set to "Off"
      When I choose "On-device"
      And I tap the back button
      And I reopen settings
      Then "Off" is still selected

  Rule: On-device mode

    Scenario: Being told the trade before downloading
      When I choose "On-device"
      Then the phone explains that speech is recognised on the phone, that nothing is sent
        anywhere, that it works without a connection, and that it is English only
      And a "Download (41 MB)" button
      And the phone suggests doing it on Wi-Fi

    Scenario: Watching it download
      Given I chose "On-device"
      When I tap "Download (41 MB)"
      Then a progress bar appears
      And it reads how much has arrived out of the total, like "24 MB / 41 MB"
      And a "Cancel" button

    Scenario: Finishing
      Given the download is running
      When it completes
      Then the phone shows "Downloaded ✓"
      And a "Remove" button
      And voice input works on the glasses without restarting the app once on-device is saved

    Scenario: Changing my mind partway
      Given the download is running
      When I tap "Cancel"
      Then the download stops
      And the "Download (41 MB)" button comes back

    Scenario: Switching mode while a download is running
      Given the download is running
      When I choose "Cloud (Soniox)"
      And the download completes
      Then "Cloud (Soniox)" is still selected
      And on-device voice is not turned back on

    Scenario: It failed
      Given the download failed
      Then the phone shows why
      And a "Try again" button

    Scenario: Getting the space back
      Given the model is downloaded
      When I tap "Remove"
      Then the model is deleted
      And the glasses go back to asking for a download

    Scenario: It is only downloaded once
      Given the model is downloaded
      When I close the app and open it again
      Then it is still downloaded
      And nothing is downloaded again

  Rule: Cloud mode

    Scenario: Being told where the audio goes, before typing anything
      When I choose "Cloud (Soniox)"
      Then the phone shows "Audio is sent to Soniox for transcription."
      And it says it uses Soniox STT, understands 60+ languages, and needs a connection and a
        Soniox API key
      And it says Soniox bills about $0.12 per hour of recording

    Scenario: Entering the key
      Given I chose "Cloud (Soniox)"
      Then there is a "Soniox API key" field
      And what I type into it is masked
      And the phone says it is stored on this device only

    Scenario: The key takes effect when Save succeeds
      Given I chose "Cloud (Soniox)"
      When I paste a valid key
      And I tap "Save"
      Then voice input works on the glasses without restarting the app

    Scenario: An obviously incomplete key
      Given I chose "Cloud (Soniox)"
      When I type a few characters
      Then the field is marked invalid
      And nothing is saved

  Rule: The key is treated as a secret

    Scenario: It never reaches the debug log
      Given I saved a Soniox API key
      When I copy the debug log
      Then the key does not appear anywhere in it

    Scenario: It never reaches our server
      Given I saved a Soniox API key
      When the glasses load any list from Notion
      Then the key is not part of that request
